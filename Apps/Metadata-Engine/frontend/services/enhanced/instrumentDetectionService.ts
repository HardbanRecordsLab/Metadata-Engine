/**
 * Advanced Rule-Based Instrument Detection
 * Uses spectral analysis data + BPM + energy + stereo profile
 * to infer present instruments with genre-aware refinement.
 */

export interface InstrumentDetection {
    instruments: string[];
    confidence: number;
    method: 'DSP Frequency Analysis';
    percussionDetected: boolean;
    hasVocals: boolean;
    acousticScore: number; // 0-100 (0=fully electronic, 100=fully acoustic)
}

interface FrequencyProfile {
    low: number;   // 0-100%
    mid: number;
    high: number;
    character: string;
}

interface DSPContext {
    balance: FrequencyProfile;
    bpm: number;
    energy: string;
    stereoWidth: number;
    loudness: number;
    brightness?: string;
    spectralCentroid?: number;
    dynamicRange?: number;
    stereoCorrelation?: number;
}

// ── HELPERS ───────────────────────────────────────────────────

function energyScore(energy: string): number {
    const map: Record<string, number> = { 'Very High': 5, 'High': 4, 'Medium': 3, 'Low': 2, 'Very Low': 1 };
    return map[energy] ?? 3;
}

// ── CORE DETECTION ────────────────────────────────────────────

export const detectInstruments = (ctx: DSPContext): InstrumentDetection => {
    const { balance, bpm, energy, stereoWidth, loudness, brightness, spectralCentroid = 1500, dynamicRange = 6, stereoCorrelation = 0.5 } = ctx;
    const { low, mid, high, character } = balance;
    const eScore = energyScore(energy);

    const candidates: Array<{ name: string; weight: number }> = [];

    // ── Percussion / Rhythm Section ───────────────────────────
    let percussionDetected = false;

    if (bpm > 0) {
        percussionDetected = true;
        if (bpm >= 140) {
            if (low > 40) candidates.push({ name: 'Kick Drum (Electronic)', weight: 35 });
            if (high > 30) candidates.push({ name: 'Rolling Hi-Hats', weight: 30 });
            candidates.push({ name: 'Snare Drum', weight: 25 });
        } else if (bpm >= 120) {
            if (character === 'Bass Heavy' || low > 45) {
                candidates.push({ name: 'Four-on-Floor Kick', weight: 35 });
            } else {
                candidates.push({ name: 'Electronic Drum Kit', weight: 30 });
            }
            if (high > 28) candidates.push({ name: 'Open Hi-Hats', weight: 25 });
        } else if (bpm >= 90) {
            candidates.push({ name: 'Live Drum Kit', weight: 30 });
            if (high > 30) candidates.push({ name: 'Ride Cymbal', weight: 18 });
        } else if (bpm >= 60) {
            if (dynamicRange > 12) {
                // High dynamic range + slow tempo = likely acoustic/live
                candidates.push({ name: 'Acoustic Drum Kit', weight: 28 });
            } else {
                candidates.push({ name: 'Trap Hi-Hats', weight: 28 });
                candidates.push({ name: '808 Kick', weight: 30 });
            }
        }
    }

    // ── Bass ──────────────────────────────────────────────────
    if (low > 45) {
        if (dynamicRange > 10) {
            candidates.push({ name: 'Electric Bass Guitar', weight: 28 });
        } else if (bpm < 100) {
            candidates.push({ name: '808 Sub Bass', weight: 32 });
        } else {
            candidates.push({ name: 'Synth Bass', weight: 28 });
        }
    } else if (low > 30) {
        if (eScore <= 2 || dynamicRange > 12) {
            candidates.push({ name: 'Upright Bass', weight: 22 });
        } else {
            candidates.push({ name: 'Bass Guitar', weight: 22 });
        }
    }

    // ── Midrange (Melodic/Harmonic) ───────────────────────────
    if (mid > 50) {
        if (eScore >= 4) {
            if (bpm < 100 && dynamicRange > 10) {
                candidates.push({ name: 'Electric Guitar (Distorted)', weight: 25 });
            } else if (bpm >= 120) {
                candidates.push({ name: 'Synth Lead', weight: 28 });
            } else {
                candidates.push({ name: 'Electric Guitar', weight: 22 });
            }
        } else {
            if (stereoWidth > 0.55 || dynamicRange > 12) {
                candidates.push({ name: 'Grand Piano', weight: 25 });
            } else {
                candidates.push({ name: 'Electric Piano', weight: 20 });
            }
        }
    } else if (mid >= 35) {
        if (bpm < 90 && dynamicRange > 10) {
            candidates.push({ name: 'Acoustic Guitar', weight: 22 });
        } else if (bpm >= 120) {
            candidates.push({ name: 'Synth Pad', weight: 20 });
        } else {
            candidates.push({ name: 'String Section', weight: 18 });
        }
    }

    // ── High-Frequency Content ────────────────────────────────
    if (high > 40) {
        if (eScore >= 4) {
            candidates.push({ name: 'Crash Cymbal', weight: 18 });
        } else {
            candidates.push({ name: 'Shaker / Percussion', weight: 15 });
        }
    }

    // ── Vocal Detection ───────────────────────────────────────
    // Vocals tend to live in 200-3000 Hz, dynamic range often > 8 dB, stereo correlation moderate
    let hasVocals = false;
    if (spectralCentroid > 600 && spectralCentroid < 3000 && dynamicRange > 6 && eScore >= 2) {
        // Check if mid range is prominent and not just synths
        if (mid > 35 && stereoCorrelation > 0.3 && stereoCorrelation < 0.9) {
            hasVocals = true;
            candidates.push({ name: 'Vocals', weight: 25 });
        }
    }

    // ── Ambient / Atmospheric ─────────────────────────────────
    if (stereoWidth > 0.65 && eScore <= 3) {
        candidates.push({ name: 'Reverb Pads', weight: 15 });
    }
    if (character.includes('Bright') && high > 35 && eScore <= 2) {
        candidates.push({ name: 'Synth Arpegio', weight: 14 });
    }

    // ── Full Mix Indicators ───────────────────────────────────
    if (low >= 28 && mid >= 28 && high >= 20 && eScore >= 3) {
        if (dynamicRange > 10) {
            candidates.push({ name: 'Full Band Mix', weight: 20 });
        } else {
            candidates.push({ name: 'Layered Synthesizers', weight: 18 });
        }
    }

    // ── Acousticness Score ────────────────────────────────────
    // High dynamic range + wide stereo + mid-centred spectrum → acoustic
    let acousticScore = 0;
    if (dynamicRange > 14) acousticScore += 30;
    else if (dynamicRange > 8) acousticScore += 15;
    if (spectralCentroid > 600 && spectralCentroid < 2500) acousticScore += 20;
    if (stereoWidth > 0.4 && stereoWidth < 0.8) acousticScore += 15;
    if (eScore <= 3) acousticScore += 10;
    if (character !== 'Bass Heavy') acousticScore += 10;
    acousticScore = Math.min(100, acousticScore);

    // ── Sort by weight, dedup, take top 5 ────────────────────
    const seen = new Set<string>();
    const sorted = candidates
        .filter(c => { if (seen.has(c.name)) return false; seen.add(c.name); return true; })
        .sort((a, b) => b.weight - a.weight)
        .slice(0, 5);

    // Ensure minimum 3 results
    while (sorted.length < 3) {
        const filler = sorted.length === 0 ? 'Electronic Production'
            : sorted.length === 1 ? 'Studio Processing'
            : 'Digital Synthesis';
        if (!seen.has(filler)) { sorted.push({ name: filler, weight: 5 }); seen.add(filler); }
        else break;
    }

    const instruments = sorted.map(c => c.name);
    const topWeight = sorted[0]?.weight ?? 0;
    const confidence = Math.min(100, Math.round(topWeight * 1.5 + (sorted.length / 5) * 20));

    return { instruments, confidence, method: 'DSP Frequency Analysis', percussionDetected, hasVocals, acousticScore };
};

// ── GENRE-AWARE REFINEMENT ────────────────────────────────────

export const detectInstrumentsWithGenre = (ctx: DSPContext, genre?: string): InstrumentDetection => {
    const base = detectInstruments(ctx);
    if (!genre) return base;

    const g = genre.toLowerCase();
    const refined = [...base.instruments];
    const { balance: { low, mid, high }, bpm } = ctx;

    if (g.includes('techno') || g.includes('house')) {
        if (low > 35 && !refined.some(i => i.includes('Kick'))) refined[0] = 'Four-on-Floor Kick';
        if (high > 25 && !refined.some(i => i.includes('Hat'))) refined[refined.length - 1] = 'Open Hi-Hats';
    }

    if (g.includes('trap') || g.includes('hip-hop') || g.includes('hip hop')) {
        if (low > 35 && !refined.some(i => i.includes('808'))) refined[0] = '808 Sub Bass';
        if (high > 25 && !refined.some(i => i.includes('Hat'))) refined[1] = 'Trap Hi-Hats';
    }

    if (g.includes('rock') || g.includes('metal')) {
        if (mid > 35 && !refined.some(i => i.includes('Guitar'))) refined[1] = 'Distorted Electric Guitar';
        if (low > 28 && !refined.some(i => i.includes('Bass'))) refined[0] = 'Bass Guitar';
    }

    if (g.includes('jazz') || g.includes('soul') || g.includes('blues')) {
        if (mid > 40) refined[1] = 'Acoustic Piano';
        if (low >= 20 && low <= 35) refined[0] = 'Upright Bass';
        if (high > 20) refined[refined.length - 1] = 'Ride Cymbal';
    }

    if (g.includes('classical') || g.includes('orchestral')) {
        if (mid > 40) refined[0] = 'String Section';
        refined[1] = 'Orchestral Brass';
        if (high > 20) refined[2] = 'Woodwinds';
    }

    return {
        ...base,
        instruments: refined.slice(0, 5),
        confidence: Math.min(100, base.confidence + 15),
    };
};
