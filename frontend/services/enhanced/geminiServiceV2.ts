import { GoogleGenerativeAI } from "@google/generative-ai";
import { Metadata, MarketIntelligence } from '../../types';
import { analyzeAudioFeatures, AudioFeatures } from '../audioAnalysisService';

// Fallback to empty string for keys to prevent crash; will fail gracefully if key is missing
const getApiKey = () => (import.meta as any).env?.VITE_GOOGLE_API_KEY || "";
const genAI = new GoogleGenerativeAI(getApiKey());

const FLASH_MODEL = 'gemini-1.5-flash';
const PRO_MODEL = 'gemini-1.5-flash'; // Stable fallback

const SCHEMA = {
    type: "object",
    properties: {
        title: { type: "string" },
        artist: { type: "string" },
        album: { type: "string" },
        year: { type: "string" },
        mainGenre: {
            type: "string",
            description: "MUST be specific genre, NOT 'Electronic', 'Independent', or 'Alternative'. Examples: 'Melodic Techno', 'Liquid Drum & Bass', 'Lo-Fi Hip Hop'"
        },
        additionalGenres: {
            type: "array",
            items: { type: "string" },
            minItems: 3,
            description: "EXACTLY 3 specific sub-genres that accurately describe the track based on actual audio analysis"
        },
        moods: {
            type: "array",
            items: { type: "string" },
            minItems: 5,
            maxItems: 5,
            description: "EXACTLY 5 nuanced, complex moods (e.g., 'Melancholic yet hopeful', NOT just 'Atmospheric')"
        },
        trackDescription: {
            type: "string",
            minLength: 100,
            description: "MANDATORY FIELD - MUST ALWAYS BE FILLED. A professional, evocative paragraph."
        },
        keywords: {
            type: "array",
            items: { type: "string" },
            minItems: 8,
            description: "MINIMUM 8 specific, descriptive keywords/hashtags."
        },
        mainInstrument: {
            type: "string",
            description: "The PRIMARY/DOMINANT instrument."
        },
        instrumentation: {
            type: "array",
            items: { type: "string" },
            minItems: 3,
            description: "EXACTLY 3 instruments: 1 main instrument + 2 supporting instruments."
        },
        tempoCharacter: { type: "string" },
        energy_level: { type: "string" },
        vocalStyle: {
            type: "object",
            properties: {
                gender: { type: "string" },
                timbre: { type: "string" },
                delivery: { type: "string" },
                emotionalTone: { type: "string" }
            }
        }
    },
    required: ["trackDescription", "mainGenre", "additionalGenres", "moods", "keywords", "instrumentation"]
};

const cleanAndParseJSON = (text: string | undefined) => {
    if (!text) return {};
    let cleanText = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    const firstBrace = cleanText.indexOf('{');
    const lastBrace = cleanText.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
        cleanText = cleanText.substring(firstBrace, lastBrace + 1);
    }
    try {
        return JSON.parse(cleanText);
    } catch (e) {
        console.error("JSON Parse Error:", e);
        return {};
    }
};

export const generateMetadataV2 = async (
    file: File | null,
    modelPreference: 'flash' | 'pro' = 'flash'
): Promise<Partial<Metadata>> => {
    let dspFeatures: AudioFeatures | null = null;
    if (file) {
        try { dspFeatures = await analyzeAudioFeatures(file); } catch (e) { console.warn("DSP failed", e); }
    }

    const selectedModel = modelPreference === 'pro' ? PRO_MODEL : FLASH_MODEL;
    const model = genAI.getGenerativeModel({
        model: selectedModel,
        generationConfig: {
            responseMimeType: "application/json",
            // @ts-ignore
            responseSchema: SCHEMA
        }
    });

    const dspContext = dspFeatures ? `
  TECHNICAL DATA:
  - Tempo: ${dspFeatures.bpm} BPM
  - Key: ${dspFeatures.key} ${dspFeatures.mode}
  - Energy: ${dspFeatures.energy}
  - Spectral Balance: ${dspFeatures.spectralBalance?.character}
  - Duration: ${Math.floor(dspFeatures.duration / 60)}:${Math.floor(dspFeatures.duration % 60)}
  ` : 'DSP data unavailable';

    const prompt = `You are an elite music analyst. Analyze this track: ${file?.name || 'Unknown'}
    ${dspContext}
    
    Provide professional, deep metadata. Be ultra-specific. No generic genres.
    The trackDescription must be a rich, evocative paragraph (3-5 sentences).
    `;

    try {
        const result = await model.generateContent(prompt);
        const response = result.response;
        const aiData = cleanAndParseJSON(response.text());

        return {
            ...aiData,
            bpm: dspFeatures?.bpm || aiData.bpm || 0,
            key: dspFeatures?.key || aiData.key || "C",
            mode: dspFeatures?.mode || aiData.mode || "Major",
            duration: dspFeatures?.duration || aiData.duration || 0
        };
    } catch (e) {
        console.error("Gemini V2 Error:", e);
        throw e;
    }
};

export const generateMarketingContentV2 = async (metadata: Metadata, type: string, tone: string): Promise<string> => {
    const model = genAI.getGenerativeModel({ model: FLASH_MODEL });

    const contextStr = `
        Track: ${metadata.title}
        Artist: ${metadata.artist}
        Genre: ${metadata.mainGenre} (${metadata.additionalGenres?.join(', ')})
        Moods: ${metadata.moods?.join(', ')}
        Tempo/Key: ${metadata.bpm} BPM, ${metadata.key} ${metadata.mode}
        Energy: ${metadata.energy_level || metadata.energyLevel}
        Instrumentation: ${metadata.instrumentation?.join(', ')}
        Description: ${metadata.trackDescription}
        Keywords: ${metadata.keywords?.join(', ')}
    `;

    const prompts: Record<string, string> = {
        social: `Write an engaging Instagram/Social Media post for this track. Use emojis, mention the vibe, and include 5 relevant hashtags based on keywords. Tone: ${tone}.`,
        press: `Write a professional press release snippet (1-2 paragraphs) for this track. Focus on the artistic value and technical quality. Tone: ${tone}.`,
        bio: `Write a compelling streaming platform bio (Spotify/Apple Music style) for this track. Make it evocative and shareable. Tone: ${tone}.`,
        sync_pitch: `Write a professional sync pitch for music supervisors. Explain why this track fits specific visual scenes (e.g. action, drama, commercial). Mention tech specs like BPM and Key. Tone: ${tone}.`,
        video_ad: `Write a 30-second video ad script/voiceover for this track. Focus on the emotional impact and hook. Tone: ${tone}.`
    };

    const selectedPrompt = prompts[type] || `Write a ${tone} promotional text for this track.`;

    try {
        const result = await model.generateContent(`
            ${selectedPrompt}
            
            Track Data:
            ${contextStr}
            
            Return ONLY the text content, no preamble.
        `);
        const response = result.response;
        return response.text() || "Generation failed.";
    } catch (e) {
        console.error("Marketing Gen Error:", e);
        return "Generation failed.";
    }
};
