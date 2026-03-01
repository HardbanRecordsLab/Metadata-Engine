import { Metadata } from '../types';
import { callAIProxy } from './aiProxyService';

const MODEL = 'llama3-70b-8192';

const extractJSON = (text: string): any => {
    try {
        let cleanText = text.replace(/```json/gi, '').replace(/```/g, '').trim();
        const firstOpen = cleanText.indexOf('{');
        const lastClose = cleanText.lastIndexOf('}');
        if (firstOpen !== -1 && lastClose !== -1) {
            cleanText = cleanText.substring(firstOpen, lastClose + 1);
        }
        return JSON.parse(cleanText);
    } catch (e) {
        return {};
    }
};

export const callGroqMetadata = async (
    dspFeatures: any,
    fileName: string,
    _schema: any
): Promise<Metadata> => {

    // Build rich context from all available DSP features
    const bpm = dspFeatures?.bpm ?? 0;
    const key = dspFeatures?.key ?? 'Unknown';
    const mode = dspFeatures?.mode ?? 'Unknown';
    const loudnessDb = dspFeatures?.loudnessDb ?? 'N/A';
    const energy = dspFeatures?.energy ?? 'Unknown';
    const brightness = dspFeatures?.brightness ?? 'Unknown';
    const tempoChar = dspFeatures?.tempoCharacter ?? '';
    const dynamicRange = dspFeatures?.dynamicRange ?? 'N/A';
    const spectralCentroid = dspFeatures?.spectralCentroid ?? 'N/A';
    const spectralRolloff = dspFeatures?.spectralRolloff ?? 'N/A';
    const stereoWidth = dspFeatures?.stereo?.width ?? 'N/A';
    const stereoCorr = dspFeatures?.stereo?.correlation ?? 'N/A';
    const balanceLow = dspFeatures?.balance?.low ?? 33;
    const balanceMid = dspFeatures?.balance?.mid ?? 34;
    const balanceHigh = dspFeatures?.balance?.high ?? 33;
    const balanceChar = dspFeatures?.balance?.character ?? 'Balanced';

    // Derive genre hints from filename
    const cleanName = fileName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');

    const prompt = `You are a professional music metadata specialist and A&R expert with deep knowledge of all music genres, production styles, and sync licensing.

Analyze the following audio fingerprint and generate comprehensive metadata.

## AUDIO ANALYSIS DATA
- File Name: "${cleanName}"
- BPM: ${bpm} ${tempoChar ? `(${tempoChar})` : ''}
- Musical Key: ${key} ${mode}
- Energy Level: ${energy}
- Integrated Loudness: ${loudnessDb} LUFS
- True Peak: ${dspFeatures?.truePeak ?? 'N/A'} dBTP
- Dynamic Range: ${dynamicRange} dB LRA
- Spectral Character: ${balanceChar}
- Spectral Brightness: ${brightness}
- Spectral Centroid: ${spectralCentroid} Hz
- Spectral Rolloff (85%): ${spectralRolloff} Hz
- Frequency Balance: Low ${balanceLow}% / Mid ${balanceMid}% / High ${balanceHigh}%
- Stereo Width: ${stereoWidth} (0=mono, 1=wide)
- Stereo Correlation: ${stereoCorr} (1=mono, -1=anti-phase)

## ANALYSIS GUIDELINES
Use the data above as your primary cues:
- BPM + key + energy → determine genre family (Electronic, Hip-Hop, Rock, Jazz, Classical, etc.)
- Spectral brightness + balance → infer instrumentation and production style
- Dynamic range → production era/style (e.g., heavily limited modern pop vs. organic folk)
- Stereo width → arrangement complexity
- Combine all signals to determine mood, use cases, and target audience

## OUTPUT REQUIREMENTS
Return ONLY a valid JSON object with these exact fields:

{
  "title": "string — infer from filename or generate creative title",
  "artist": "string — infer from filename or use 'Unknown Artist'",
  "album": "string — infer or use 'Single'",
  "albumArtist": "string",
  "year": "string — current year if unclear",
  "mainGenre": "string — primary genre (be specific: e.g., 'Deep House' not just 'Electronic')",
  "additionalGenres": ["array of 2-4 subgenres or related styles"],
  "moods": ["array of 3-6 specific moods matching the audio profile"],
  "instrumentation": ["array of 3-8 detected/inferred instruments"],
  "mainInstrument": "string — single dominant instrument or element",
  "trackDescription": "string — 2-3 sentence professional description for sync licensing / store metadata",
  "keywords": ["array of 10-15 SEO/discovery keywords"],
  "useCases": ["array of 4-8 sync use cases: TV, Film, Game, Ad, etc."],
  "language": "string — 'Instrumental' if no vocals, else ISO language code",
  "tempoCharacter": "string — e.g., 'Driving', 'Laid-back', 'Frenetic'",
  "musicalEra": "string — e.g., '2020s Modern', '90s Retro'",
  "productionQuality": "string — e.g., 'Studio Polished', 'Lo-Fi', 'Mastered for Streaming'",
  "targetAudience": "string — e.g., 'Electronic music fans 18-34'",
  "energyLevel": "string — Very Low / Low / Medium / High / Very High",
  "dynamics": "string — e.g., 'High Dynamic Range', 'Heavily Compressed', 'Punchy'",
  "mood_vibe": "string — 1-2 sentence poetic mood description for marketing",
  "explicitContent": "none",
  "analysisReasoning": "string — brief explanation of your genre/mood reasoning based on the audio data"
}`;

    try {
        const data = await callAIProxy('groq', {
            model: MODEL,
            messages: [
                { role: 'system', content: 'You are a music metadata API that outputs only valid JSON. Never include markdown code fences or explanations outside the JSON.' },
                { role: 'user', content: prompt }
            ],
            temperature: 0.15,
            max_tokens: 1500,
        });

        const content = data.choices[0]?.message?.content || '{}';
        const parsed = extractJSON(content);

        return {
            ...parsed,
            bpm: dspFeatures?.bpm ?? parsed.bpm,
            key: dspFeatures?.key ?? parsed.key,
            mode: dspFeatures?.mode ?? parsed.mode,
            duration: dspFeatures?.duration,
            energy_level: energy,
            energyLevel: energy,
        };

    } catch (error) {
        console.error('Groq proxy failed:', error);
        throw error;
    }
};

// ── FIELD REFINEMENT ─────────────────────────────────────────

export const callGroqRefineField = async (
    currentMetadata: Metadata,
    field: keyof Metadata,
    instruction: string
): Promise<Partial<Metadata>> => {
    const prompt = `You are a professional music metadata editor.

CURRENT METADATA:
${JSON.stringify(currentMetadata, null, 2)}

FIELD TO REFINE: "${String(field)}"
CURRENT VALUE: ${JSON.stringify(currentMetadata[field])}
INSTRUCTION: ${instruction}

Return ONLY a JSON object with the single refined field. Example: {"moods": ["Melancholic", "Dreamy"]}`;

    try {
        const data = await callAIProxy('groq', {
            model: MODEL,
            messages: [
                { role: 'system', content: 'You are a music metadata API. Output only valid JSON with a single field.' },
                { role: 'user', content: prompt }
            ],
            temperature: 0.2,
            max_tokens: 300,
        });

        const content = data.choices[0]?.message?.content || '{}';
        return extractJSON(content);
    } catch (e) {
        console.error('Refine field error:', e);
        return {};
    }
};
