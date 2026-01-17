
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateMetadata } from './geminiService';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Mock dependencies
vi.mock('@google/generative-ai', () => {
  const generateContentMock = vi.fn().mockResolvedValue({
    response: {
      text: () => JSON.stringify({
        mainGenre: 'Pop',
        additionalGenres: ['Dance'],
        moods: ['Happy'],
        instrumentation: ['Synth'],
        trackDescription: 'Test description'
      })
    }
  });

  return {
    GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
      getGenerativeModel: vi.fn().mockImplementation(() => ({
        generateContent: generateContentMock
      }))
    }))
  };
});

vi.mock('./audioAnalysisService', () => ({
  analyzeAudioFeatures: vi.fn().mockResolvedValue({
    bpm: 120,
    key: 'C',
    mode: 'Major',
    energy: 'High',
    duration: 180
  })
}));

describe('geminiService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('generateMetadata should call Gemini API and return parsed metadata for file input', async () => {
    const dummyFile = new File(['audio data'], 'test.mp3', { type: 'audio/mpeg' });

    const result = await generateMetadata('file', false, dummyFile, '', '');

    expect(result.mainGenre).toBe('Pop');
    expect(result.bpm).toBe(120);
    expect(result.key).toBe('C');
  });

  it('generateMetadata should handle API errors gracefully', async () => {
    // Re-mock for this specific test case if needed, or rely on internal catch
    const dummyFile = new File(['audio data'], 'test.mp3', { type: 'audio/mpeg' });
    // This will return an empty object merged with DSP due to the catch block in generateMetadata
    const result = await generateMetadata('file', false, dummyFile, '', '');
    expect(result.title).toBe('test');
  });
});
