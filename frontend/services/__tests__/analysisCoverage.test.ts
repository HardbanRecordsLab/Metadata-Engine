import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { generateMetadata } from '../geminiService';
import type { AudioFeatures } from '../audioAnalysisService';
import { exportMetadataToCSV } from '../exportService';

// Stub WebSocket for test environment
class WSStub {
  onmessage: any = null;
  onerror: any = null;
  readyState = 1;
  constructor(_url: string) {}
  close() { this.readyState = 3; }
}

vi.mock('../audioAnalysisService', () => {
  const dsp: AudioFeatures = {
    bpm: 128,
    key: 'F#',
    mode: 'Minor',
    duration: 242,
    spectralCentroid: 1200,
    spectralRolloff: 4800,
    energy: 'High',
    tempoCharacter: 'Driving',
    balance: { low: 33, mid: 34, high: 33, character: 'Balanced' },
    loudnessDb: -10.5,
    truePeak: -0.8,
    stereo: { width: 0.6, correlation: 0.4 },
    brightness: 'Neutral',
    structure: [
      { section: 'Intro', startTime: 0, endTime: 16, description: 'Build' },
      { section: 'Drop', startTime: 16, endTime: 64, description: 'Main' },
    ],
    dynamicRange: 8.5,
  } as any;
  return {
    analyzeAudioFeatures: vi.fn(async () => dsp),
  };
});

// Sequence stub for fetchWithRetry: first call job create, then polls return completed
let pollCount = 0;
vi.mock('../../utils/fetchWithRetry', () => {
  return {
    fetchWithRetry: vi.fn(async (_url: string, options?: any) => {
      // Job creation
      if (options?.method === 'POST') {
        return {
          ok: true,
          json: async () => ({ job_id: 'job-123' }),
          text: async () => 'ok',
        } as any;
      }
      // Polling
      pollCount++;
      return {
        ok: true,
        json: async () => ({
          status: 'completed',
          result: {
            sha256: 'deadbeef',
            title: 'Test Track',
            artist: 'Tester',
            album: 'Single',
            year: '2026',
            track: 1,
            mainInstrument: 'Synth',
            mainGenre: 'Electronic',
            moods: ['Energetic'],
            keywords: ['test', 'unit'],
            language: 'Instrumental',
            copyright: '© 2026',
            publisher: 'Independent',
            confidence: 0.94,
            validation_report: { status: 'ok', score: 95, issues: [], warnings: [] },
          },
        }),
      } as any;
    }),
  };
});

// SPEED: make waits instant in test mode
Object.defineProperty(import.meta, 'env', { value: { MODE: 'test' } });

describe('Analysis coverage and field population', () => {
  beforeAll(() => {
    // @ts-ignore
    global.WebSocket = WSStub as any;
  });
  afterAll(() => {
    // @ts-ignore
    delete (global as any).WebSocket;
  });

  it('generates metadata with >= 92% field coverage and correct key fields', async () => {
    const blob = new Blob([Uint8Array.of(0)], { type: 'audio/wav' });
    const file = new File([blob], 'EUPHORIC_MAIN.wav', { type: 'audio/wav' });

    const { metadata, audioFeatures } = await generateMetadata(
      'file', true, file, '', 'desc', undefined, 'flash'
    );

    // Expected fields to evaluate presence (union of core UI fields)
    const expectedKeys: Array<keyof typeof metadata> = [
      'sha256','title','artist','album','albumArtist','year','track','duration','coverArt',
      'mainInstrument','bpm','key','mode','mainGenre','additionalGenres','moods','instrumentation','keywords','useCases',
      'trackDescription','language','vocalStyle','structure',
      'copyright','pLine','publisher','composer','lyricist','producer',
      'catalogNumber','isrc','iswc','upc','license',
      'energy_level','energyLevel','mood_vibe','musicalEra','productionQuality','dynamics','targetAudience','tempoCharacter','analysisReasoning','similar_artists',
      'dynamicRange','spectralCentroid','spectralRolloff','validation_report','confidence',
    ];

    const present = expectedKeys.filter(k => (metadata as any)[k] !== undefined);
    const coverage = present.length / expectedKeys.length;
    expect(coverage).toBeGreaterThanOrEqual(0.92);

    // Spot checks for correctness
    expect(metadata.sha256).toBe('deadbeef');
    expect(metadata.title).toBe('Test Track');
    expect(metadata.artist).toBe('Tester');
    expect(typeof metadata.bpm).toBe('number');
    expect(metadata.key && metadata.mode).toBeTruthy();
    expect(metadata.structure && Array.isArray(metadata.structure)).toBe(true);
    expect(metadata.energy_level).toBeTruthy();
    expect(metadata.language).toBeTruthy();
    expect(metadata.validation_report && typeof metadata.validation_report).toBe('object');
    expect(audioFeatures?.tempoCharacter).toBe('Driving');
  });

  it('exports CSV including new fields without throwing', () => {
    const sample: any = {
      title: 'Sample', artist: 'A', album: 'B', mainGenre: 'Electronic',
      language: 'Instrumental', explicitContent: 'None', fileOwner: 'Owner Co',
      spectralCentroid: 1200, spectralRolloff: 4800, acousticScore: 55, hasVocals: false
    };
    expect(() => exportMetadataToCSV(sample, 'out.csv')).not.toThrow();
  });
});

