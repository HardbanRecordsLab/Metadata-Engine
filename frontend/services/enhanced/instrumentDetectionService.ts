/**
 * Rule-Based Instrument Detection Service
 * Uses DSP frequency analysis to detect actual instruments in audio
 */

export interface InstrumentDetection {
    instruments: string[];
    confidence: number;
    method: 'DSP Frequency Analysis';
}

interface FrequencyProfile {
    low: number;      // 0-100%
    mid: number;      // 0-100%
    high: number;     // 0-100%
    character: string;
}

/**
 * Detect instruments based on frequency spectrum analysis
 */
export const detectInstruments = (
    spectralBalance: FrequencyProfile,
    bpm: number,
    energy: string,
    stereoWidth: number,
    loudness: number
): InstrumentDetection => {
    const instruments: string[] = [];
    let confidence = 0;

    const { low, mid, high, character } = spectralBalance;

    // ================================================================
    // BASS DETECTION (Low Frequencies 20-250Hz)
    // ================================================================

    if (low > 40) {
        // Heavy bass presence
        if (bpm >= 60 && bpm <= 90) {
            // Hip-Hop/Trap/R&B range
            instruments.push("808 Sub Bass");
            confidence += 25;
        } else if (bpm >= 120 && bpm <= 135) {
            // House/Techno range
            if (character === "Bass-heavy") {
                instruments.push("Analog Moog Bass");
            } else {
                instruments.push("Synth Bass");
            }
            confidence += 25;
        } else if (bpm >= 140) {
            // Drum & Bass / Dubstep
            instruments.push("Reese Bass");
            confidence += 25;
        } else {
            // Generic bass
            instruments.push("Deep Bass");
            confidence += 15;
        }
    } else if (low >= 25 && low <= 40) {
        // Moderate bass
        if (bpm < 120) {
            instruments.push("Bass Guitar");
        } else {
            instruments.push("Kick Drum");
        }
        confidence += 20;
    }

    // ================================================================
    // MID DETECTION (Mid Frequencies 500Hz-2kHz)
    // ================================================================

    if (mid > 50) {
        // Mid-dominant = vocals, guitars, piano, synth leads
        if (energy === "High" || energy === "Very High") {
            if (bpm < 100) {
                instruments.push("Distorted Electric Guitar");
                confidence += 20;
            } else if (bpm >= 120 && bpm <= 140) {
                instruments.push("Synth Lead");
                confidence += 20;
            } else {
                instruments.push("Electric Guitar");
                confidence += 15;
            }
        } else {
            // Lower energy
            if (stereoWidth > 0.6) {
                instruments.push("Acoustic Grand Piano");
                confidence += 20;
            } else {
                instruments.push("Vocal");
                confidence += 15;
            }
        }
    } else if (mid >= 35 && mid <= 50) {
        // Moderate mids
        if (bpm >= 90 && bpm <= 120) {
            instruments.push("Synth Pad");
            confidence += 15;
        } else {
            instruments.push("String Section");
            confidence += 12;
        }
    }

    // ================================================================
    // HIGH DETECTION (High Frequencies 4kHz+)
    // ================================================================

    if (high > 35) {
        // Bright/crisp elements
        if (bpm >= 60 && bpm <= 100) {
            // Hip-Hop/Trap
            instruments.push("Trap Hi-Hats");
            confidence += 20;
        } else if (bpm >= 120) {
            // Electronic/Dance
            instruments.push("Crisp Hi-Hats");
            confidence += 20;
        } else {
            instruments.push("Cymbals");
            confidence += 15;
        }
    } else if (high >= 28 && high <= 35) {
        // Moderate highs
        if (energy === "High" || energy === "Very High") {
            instruments.push("Crash Cymbals");
            confidence += 15;
        } else {
            instruments.push("Shaker");
            confidence += 12;
        }
    }

    // ================================================================
    // BALANCE-BASED DETECTION (Balanced mixes)
    // ================================================================

    if (low >= 30 && low <= 35 && mid >= 30 && mid <= 40 && high >= 25 && high <= 35) {
        // Well-balanced = full production
        if (bpm >= 60 && bpm <= 90) {
            instruments.push("Live Drum Kit");
            confidence += 15;
        } else if (bpm >= 120 && bpm <= 140) {
            instruments.push("Layered Synthesizers");
            confidence += 15;
        } else {
            instruments.push("Full Band Mix");
            confidence += 12;
        }
    }

    // ================================================================
    // STEREO WIDTH DETECTION
    // ================================================================

    if (stereoWidth > 0.7 && instruments.length < 3) {
        // Wide stereo = ambient elements
        instruments.push("Reverb Pads");
        confidence += 10;
    }

    // ================================================================
    // LOUDNESS DETECTION (Dynamics)
    // ================================================================

    if (loudness > -6 && energy === "Very High") {
        // Heavily compressed / mastered
        if (!instruments.some(i => i.includes("Drum"))) {
            instruments.push("Compressed Drums");
            confidence += 10;
        }
    }

    // ================================================================
    // ENSURE EXACTLY 3 INSTRUMENTS
    // ================================================================

    // If we have more than 3, keep the most confident ones (first detected)
    if (instruments.length > 3) {
        instruments.splice(3);
    }

    // If we have less than 3, add generic fills
    while (instruments.length < 3) {
        if (instruments.length === 0) {
            instruments.push("Electronic Production");
        } else if (instruments.length === 1) {
            instruments.push("Studio Elements");
        } else {
            instruments.push("Digital Processing");
        }
        confidence -= 5;
    }

    // Normalize confidence to 0-100
    confidence = Math.max(0, Math.min(100, confidence));

    return {
        instruments,
        confidence,
        method: 'DSP Frequency Analysis'
    };
};

/**
 * Advanced instrument detection with genre context
 */
export const detectInstrumentsWithGenre = (
    spectralBalance: FrequencyProfile,
    bpm: number,
    energy: string,
    stereoWidth: number,
    loudness: number,
    genre?: string
): InstrumentDetection => {
    const baseDetection = detectInstruments(spectralBalance, bpm, energy, stereoWidth, loudness);

    // Refine based on genre if provided
    if (genre) {
        const { low, mid, high } = spectralBalance;
        const refinedInstruments = [...baseDetection.instruments];

        // Genre-specific refinements
        if (genre.toLowerCase().includes('techno') || genre.toLowerCase().includes('house')) {
            if (low > 35 && !refinedInstruments.some(i => i.includes('Bass'))) {
                refinedInstruments[0] = 'Four-on-Floor Kick';
            }
            if (high > 30 && !refinedInstruments.some(i => i.includes('Hat'))) {
                refinedInstruments[2] = 'Open Hi-Hats';
            }
        }

        if (genre.toLowerCase().includes('rock') || genre.toLowerCase().includes('metal')) {
            if (mid > 40 && !refinedInstruments.some(i => i.includes('Guitar'))) {
                refinedInstruments[1] = 'Distorted Electric Guitar';
            }
            if (low > 30 && !refinedInstruments.some(i => i.includes('Bass'))) {
                refinedInstruments[0] = 'Bass Guitar';
            }
        }

        if (genre.toLowerCase().includes('jazz') || genre.toLowerCase().includes('acoustic')) {
            if (mid > 45) {
                refinedInstruments[1] = 'Acoustic Piano';
            }
            if (low >= 25 && low <= 35) {
                refinedInstruments[0] = 'Upright Bass';
            }
        }

        return {
            ...baseDetection,
            instruments: refinedInstruments,
            confidence: baseDetection.confidence + 10 // Genre context increases confidence
        };
    }

    return baseDetection;
};
