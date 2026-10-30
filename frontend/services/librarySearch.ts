/**
 * "My library": search a producer's own analysed tracks by how they SOUND.
 *
 * Every Engine 3.0 analysis stores a `sonicVector` (a 512-d audio-model embedding, L2-normalised, float16, base64). The backend's public
 * `/intelligence/embed-text` turns a description ("dark driving techno for a chase scene") into a vector in the same space, so a cosine
 * ranks the tracks without any server-side catalogue. Similar tracks and duplicates need no network at all.
 * Older analyses have no vector; they stay searchable by the text filters and are counted so the UI can say so.
 */
import type { AnalysisRecord } from '../types';

const API_BASE = '/api';

/** IEEE half-precision float (what numpy `float16` writes) to a JS number. */
export function halfToFloat(h: number): number {
  const sign = h & 0x8000 ? -1 : 1;
  const exp = (h >> 10) & 0x1f;
  const frac = h & 0x3ff;
  if (exp === 0) return sign * Math.pow(2, -14) * (frac / 1024);
  if (exp === 0x1f) return frac ? NaN : sign * Infinity;
  return sign * Math.pow(2, exp - 15) * (1 + frac / 1024);
}

export function unpackVector(b64: string): Float32Array | null {
  try {
    const bin = atob(b64);
    if (bin.length < 2 || bin.length % 2) return null;
    const out = new Float32Array(bin.length / 2);
    for (let i = 0; i < out.length; i++) out[i] = halfToFloat(bin.charCodeAt(2 * i) | (bin.charCodeAt(2 * i + 1) << 8));   // little-endian
    return out.every(Number.isFinite) ? out : null;
  } catch {
    return null;
  }
}

export function cosine(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return na > 0 && nb > 0 ? dot / Math.sqrt(na * nb) : 0;
}

export interface Hit { record: AnalysisRecord; similarity: number }

const vectorOf = (r: AnalysisRecord): Float32Array | null => {
  const v = (r.metadata as { sonicVector?: unknown } | undefined)?.sonicVector;
  return typeof v === 'string' ? unpackVector(v) : null;
};

/** How many of the records can take part in a sound search at all. */
export function coverage(records: AnalysisRecord[]): { withVector: number; total: number } {
  return { withVector: records.filter((r) => vectorOf(r)).length, total: records.length };
}

export function rankBySimilarity(query: Float32Array, records: AnalysisRecord[], top = 20, minSimilarity = 0): Hit[] {
  const hits: Hit[] = [];
  for (const record of records) {
    const v = vectorOf(record);
    if (!v) continue;
    const similarity = cosine(query, v);
    if (similarity >= minSimilarity) hits.push({ record, similarity });
  }
  return hits.sort((x, y) => y.similarity - x.similarity).slice(0, top);
}

/** Tracks that sound like `record` (the record itself is left out). Roughly: >= 0.97 the same recording or another master of it. */
export function findSimilar(record: AnalysisRecord, records: AnalysisRecord[], top = 10): Hit[] {
  const v = vectorOf(record);
  if (!v) return [];
  return rankBySimilarity(v, records.filter((r) => r.id !== record.id), top);
}

export const DUPLICATE_THRESHOLD = 0.985;

/** Groups of two or more records that are the same recording (cosine >= threshold, transitively). Biggest groups first. */
export function findDuplicates(records: AnalysisRecord[], threshold = DUPLICATE_THRESHOLD): AnalysisRecord[][] {
  const items = records.map((record) => ({ record, v: vectorOf(record) })).filter((x): x is { record: AnalysisRecord; v: Float32Array } => x.v !== null);
  const parent = items.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (cosine(items[i].v, items[j].v) >= threshold) parent[find(i)] = find(j);
    }
  }
  const groups = new Map<number, AnalysisRecord[]>();
  items.forEach((x, i) => { const r = find(i); groups.set(r, [...(groups.get(r) ?? []), x.record]); });
  return [...groups.values()].filter((g) => g.length > 1).sort((a, b) => b.length - a.length);
}

/** Description -> vector in the audio model's space (public endpoint, ~50 ms). Throws a readable message when it cannot. */
export async function embedQuery(text: string, fetcher: typeof fetch = fetch): Promise<Float32Array> {
  const q = text.trim().slice(0, 300);
  if (!q) throw new Error('Describe the sound you are looking for.');
  const res = await fetcher(`${API_BASE}/intelligence/embed-text`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ queries: [q] }),
  });
  if (res.status === 503) throw new Error('The sound-search model is starting up. Try again in a minute.');
  if (res.status === 429) throw new Error('Too many searches in a short time. Wait a moment.');
  if (!res.ok) throw new Error('Sound search is not available right now.');
  const data = await res.json();
  const v = typeof data?.vectors?.[0] === 'string' ? unpackVector(data.vectors[0]) : null;
  if (!v) throw new Error('Sound search returned an unreadable answer.');
  return v;
}
