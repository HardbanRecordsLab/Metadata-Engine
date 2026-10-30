import { describe, it, expect } from 'vitest';
import {
  halfToFloat, unpackVector, cosine, coverage, rankBySimilarity, findSimilar, findDuplicates, embedQuery, DUPLICATE_THRESHOLD,
} from '../librarySearch';
import type { AnalysisRecord } from '../../types';

/** pack a float vector the way the backend does: L2-normalise, float16, little-endian, base64 */
function f32ToHalf(x: number): number {
  const buf = new DataView(new ArrayBuffer(4));
  buf.setFloat32(0, x);
  const b = buf.getUint32(0);
  const sign = (b >> 16) & 0x8000;
  let exp = ((b >> 23) & 0xff) - 127 + 15;
  const frac = b & 0x7fffff;
  if (x === 0) return sign;
  if (exp <= 0) return sign | (Math.round((frac | 0x800000) >> (14 - exp)) & 0x3ff);
  if (exp >= 31) return sign | 0x7c00;
  return sign | (exp << 10) | (frac >> 13);
}
function pack(vec: number[]): string {
  const n = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  const bytes: number[] = [];
  for (const v of vec) { const h = f32ToHalf(v / n); bytes.push(h & 0xff, h >> 8); }
  return btoa(String.fromCharCode(...bytes));
}
const rec = (id: string, vec: number[] | null, extra: Record<string, unknown> = {}): AnalysisRecord =>
  ({ id, inputType: 'file', input: { fileName: `${id}.wav` }, metadata: { title: id, ...(vec ? { sonicVector: pack(vec) } : {}), ...extra } } as unknown as AnalysisRecord);

describe('half-precision decoding', () => {
  it('matches known IEEE half values', () => {
    expect(halfToFloat(0x3c00)).toBe(1);
    expect(halfToFloat(0xc000)).toBe(-2);
    expect(halfToFloat(0x3800)).toBe(0.5);
    expect(halfToFloat(0x0000)).toBe(0);
    expect(halfToFloat(0x7bff)).toBe(65504);                         // the largest finite half
    expect(halfToFloat(0x0001)).toBeCloseTo(5.960464477539063e-8, 20);   // the smallest subnormal
    expect(halfToFloat(0x7c00)).toBe(Infinity);
    expect(halfToFloat(0xfc00)).toBe(-Infinity);
    expect(Number.isNaN(halfToFloat(0x7e00))).toBe(true);
  });

  it('round-trips a packed vector to within half precision', () => {
    const v = [0.3, -0.7, 0.01, 0.5, -0.2, 0.9, 0, 0.123];
    const n = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
    const back = unpackVector(pack(v))!;
    expect(back.length).toBe(8);
    back.forEach((x, i) => expect(Math.abs(x - v[i] / n)).toBeLessThan(1e-3));
  });

  it('refuses garbage and odd lengths instead of throwing', () => {
    expect(unpackVector('')).toBeNull();
    expect(unpackVector('!!!not base64!!!')).toBeNull();
    expect(unpackVector(btoa('abc'))).toBeNull();                    // 3 bytes: not a whole number of halves
    expect(unpackVector(btoa(String.fromCharCode(0x00, 0x7e)))).toBeNull();   // NaN
  });
});

describe('cosine', () => {
  it('is 1 for the same direction, 0 for orthogonal, -1 for opposite, 0 for mismatched or empty', () => {
    const a = Float32Array.of(1, 2, 3);
    expect(cosine(a, Float32Array.of(2, 4, 6))).toBeCloseTo(1, 6);
    expect(cosine(Float32Array.of(1, 0), Float32Array.of(0, 1))).toBeCloseTo(0, 6);
    expect(cosine(a, a.map((x) => -x))).toBeCloseTo(-1, 6);
    expect(cosine(a, Float32Array.of(1, 2))).toBe(0);
    expect(cosine(new Float32Array(0), new Float32Array(0))).toBe(0);
    expect(cosine(Float32Array.of(0, 0), Float32Array.of(1, 1))).toBe(0);
  });
});

// a tiny "sound space": dark techno near [1,0,0], deep house near [0.9,0.4,0], ambient near [0,0,1]
const LIB = [
  rec('techno-a', [1, 0.05, 0]), rec('techno-b', [0.98, 0.1, 0.02]), rec('house', [0.9, 0.4, 0]), rec('ambient', [0.02, 0.05, 1]),
  rec('old-analysis', null),
];

describe('ranking', () => {
  it('ranks by sound and skips analyses without a vector', () => {
    const q = unpackVector(pack([1, 0, 0]))!;
    const hits = rankBySimilarity(q, LIB, 10);
    expect(hits.map((h) => h.record.id)).toEqual(['techno-a', 'techno-b', 'house', 'ambient']);
    expect(hits[0].similarity).toBeGreaterThan(0.99);
    expect(hits.some((h) => h.record.id === 'old-analysis')).toBe(false);
    expect(rankBySimilarity(q, LIB, 2).length).toBe(2);
    expect(rankBySimilarity(q, LIB, 10, 0.5).map((h) => h.record.id)).toEqual(['techno-a', 'techno-b', 'house']);
  });

  it('counts how much of the library can be searched', () => {
    expect(coverage(LIB)).toEqual({ withVector: 4, total: 5 });
    expect(coverage([])).toEqual({ withVector: 0, total: 0 });
  });

  it('finds similar tracks without returning the track itself', () => {
    const hits = findSimilar(LIB[0], LIB, 3);
    expect(hits.map((h) => h.record.id)).toEqual(['techno-b', 'house', 'ambient']);
    expect(findSimilar(LIB[4], LIB)).toEqual([]);                    // no vector: nothing to compare
  });
});

describe('duplicates', () => {
  it('groups the same recording, transitively, and leaves distinct tracks alone', () => {
    const a = [1, 0.2, 0.1, 0.3];
    const lib = [rec('master-v1', a), rec('master-v2', a.map((x) => x * 1.001 + 0.0005)), rec('remaster', a.map((x) => x + 0.002)),
                 rec('other', [0.1, 1, 0.2, 0.1]), rec('other-too', [0.1, 1.001, 0.2, 0.1]), rec('lonely', [0.2, 0.1, 1, 0.9]), rec('no-vector', null)];
    const groups = findDuplicates(lib).map((g) => g.map((r) => r.id).sort());
    expect(groups).toEqual([['master-v1', 'master-v2', 'remaster'], ['other', 'other-too']]);
    expect(DUPLICATE_THRESHOLD).toBeGreaterThan(0.97);
    expect(findDuplicates([])).toEqual([]);
    expect(findDuplicates([rec('x', [1, 0, 0])])).toEqual([]);
  });
});

describe('embedQuery', () => {
  const ok = (vectors: string[]) => (async () => new Response(JSON.stringify({ vectors }), { status: 200 })) as unknown as typeof fetch;

  it('posts the description and returns the vector', async () => {
    let seen: { url: string; body: string } | null = null;
    const f = (async (url: string, init: RequestInit) => { seen = { url, body: String(init.body) }; return new Response(JSON.stringify({ vectors: [pack([1, 0, 0])] }), { status: 200 }); }) as unknown as typeof fetch;
    const v = await embedQuery('  dark driving techno  ', f);
    expect(seen!.url).toBe('/api/intelligence/embed-text');
    expect(JSON.parse(seen!.body)).toEqual({ queries: ['dark driving techno'] });
    expect(cosine(v, Float32Array.of(1, 0, 0))).toBeCloseTo(1, 3);
  });

  it('turns every failure into a readable message', async () => {
    await expect(embedQuery('   ', ok([]))).rejects.toThrow('Describe the sound');
    const status = (code: number) => (async () => new Response('{}', { status: code })) as unknown as typeof fetch;
    await expect(embedQuery('x', status(503))).rejects.toThrow('starting up');
    await expect(embedQuery('x', status(429))).rejects.toThrow('Too many');
    await expect(embedQuery('x', status(500))).rejects.toThrow('not available');
    await expect(embedQuery('x', ok([]))).rejects.toThrow('unreadable');
    await expect(embedQuery('x', ok(['!!!']))).rejects.toThrow('unreadable');
  });

  it('cuts a very long description to the 300 characters the endpoint accepts', async () => {
    let body = '';
    const f = (async (_u: string, init: RequestInit) => { body = String(init.body); return new Response(JSON.stringify({ vectors: [pack([1, 0])] }), { status: 200 }); }) as unknown as typeof fetch;
    await embedQuery('a'.repeat(500), f);
    expect(JSON.parse(body).queries[0].length).toBe(300);
  });
});

import { metadataFromResult } from '../databaseService';

describe('history rows come in two shapes', () => {
  it('reads metadata saved by the browser (nested) and by the backend (flat), and survives nothing', () => {
    expect(metadataFromResult({ metadata: { title: 'Nested', bpm: 120 }, inputType: 'file' })).toEqual({ title: 'Nested', bpm: 120 });
    const flat = { title: 'Flat', bpm: 124, mainGenre: 'House', sonicVector: 'AAAA' };
    expect(metadataFromResult(flat)).toBe(flat);                               // the backend's result IS the metadata
    expect(metadataFromResult(null)).toEqual({});
    expect(metadataFromResult(undefined)).toEqual({});
    expect(metadataFromResult('nope')).toEqual({});
  });
});
