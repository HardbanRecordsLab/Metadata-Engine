
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
    const prompt = `
    Analyze the Music DSP Data below.
    INPUT:
    - Filename: "${fileName}"
    - BPM: ${dspFeatures?.bpm}
    - Key: ${dspFeatures?.key} ${dspFeatures?.mode}
    - Energy: ${dspFeatures?.energy}
    TASK: Determine Genre, Subgenre, Mood, and Description.
    OUTPUT: Return ONLY valid JSON.
    {
        "title": "String",
        "artist": "String",
        "mainGenre": "String",
        "additionalGenres": ["String"],
        "moods": ["String"],
        "trackDescription": "String"
    }
    `;

    try {
        const data = await callAIProxy('groq', {
            model: MODEL,
            messages: [
                { role: 'system', content: "You are a music metadata API. Output valid JSON only." },
                { role: 'user', content: prompt }
            ],
            temperature: 0.1
        });

        const content = data.choices[0]?.message?.content || "{}";
        const parsed = extractJSON(content);
        
                return {
                    ...parsed,
                    bpm: dspFeatures?.bpm,
                    key: dspFeatures?.key,
                    mode: dspFeatures?.mode,
                    duration: dspFeatures?.duration,
                    energy_level: dspFeatures?.energy != null ? String(dspFeatures.energy) : undefined
                };

            } catch (error) {
                console.error("Groq proxy failed:", error);
                throw error;
    }
};
