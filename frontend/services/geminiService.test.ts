
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateMetadata } from './geminiService';

vi.mock('./audioAnalysisService', () => ({
  analyzeAudioFeatures: vi.fn().mockResolvedValue({
    bpm: 120,
    key: 'C',
    mode: 'Major',
    duration: 180,
    method: 'AI Estimate',
  })
}));

vi.mock('./copyrightService', () => ({
  calculateFileHash: vi.fn().mockResolvedValue('sha256-test-hash'),
}));

class MockWebSocket {
  static OPEN = 1;
  readyState = MockWebSocket.OPEN;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  constructor(_url: string) {}
  close() {
    this.readyState = 3;
  }
}

describe('geminiService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as any).WebSocket = MockWebSocket;
  });

  it('generateMetadata returns merged metadata from backend job', async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: any, _init?: any) => {
      const u = String(url);
      if (u.includes('/analysis/generate')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ job_id: 'job123' }),
          text: async () => '',
        };
      }
      if (u.includes('/analysis/job/job123')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            status: 'completed',
            result: {
              title: 'AI Title',
              artist: 'AI Artist',
              mainGenre: 'Pop',
              additionalGenres: ['Dance'],
              moods: ['Happy'],
              trackDescription: 'Test description',
              bpm: 128,
              key: 'D',
              mode: 'Major',
            },
          }),
          text: async () => '',
        };
      }
      return {
        ok: false,
        status: 404,
        json: async () => ({}),
        text: async () => 'not found',
      };
    });
    (globalThis as any).fetch = fetchMock;

    const dummyFile = new File(['audio data'], 'test.mp3', { type: 'audio/mpeg' });
    const result = await generateMetadata('file', false, dummyFile, '', '');

    expect(result.mainGenre).toBe('Pop');
    expect(result.bpm).toBe(128);
    expect(result.key).toBe('D');
    expect(result.sha256).toBe('sha256-test-hash');
  });

  it('generateMetadata throws on backend job error', async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: any, _init?: any) => {
      const u = String(url);
      if (u.includes('/analysis/generate')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ job_id: 'job123' }),
          text: async () => '',
        };
      }
      if (u.includes('/analysis/job/job123')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            status: 'error',
            error: 'boom',
          }),
          text: async () => '',
        };
      }
      return {
        ok: false,
        status: 404,
        json: async () => ({}),
        text: async () => 'not found',
      };
    });
    (globalThis as any).fetch = fetchMock;

    const dummyFile = new File(['audio data'], 'test.mp3', { type: 'audio/mpeg' });
    await expect(generateMetadata('file', false, dummyFile, '', '')).rejects.toThrow(/Analysis background error/i);
  });
});
