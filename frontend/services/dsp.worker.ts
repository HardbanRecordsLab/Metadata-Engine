
// ============================================================
// IMPROVED NATIVE DSP WORKER — Real FFT, Autocorrelation BPM,
// LUFS Loudness, Spectral Centroid, Dynamic Range
// ============================================================

// ── UTILS ────────────────────────────────────────────────────

/** In-place Cooley-Tukey radix-2 FFT */
function fft(re: Float32Array, im: Float32Array): void {
    const n = re.length;
    let j = 0;
    for (let i = 1; i < n; i++) {
        let bit = n >> 1;
        for (; j & bit; bit >>= 1) j ^= bit;
        j ^= bit;
        if (i < j) {
            [re[i], re[j]] = [re[j], re[i]];
            [im[i], im[j]] = [im[j], im[i]];
        }
    }
    for (let len = 2; len <= n; len <<= 1) {
        const halfLen = len >> 1;
        const ang = (-2 * Math.PI) / len;
        const wRe = Math.cos(ang);
        const wIm = Math.sin(ang);
        for (let i = 0; i < n; i += len) {
            let curRe = 1, curIm = 0;
            for (let k = 0; k < halfLen; k++) {
                const uRe = re[i + k];
                const uIm = im[i + k];
                const vRe = re[i + k + halfLen] * curRe - im[i + k + halfLen] * curIm;
                const vIm = re[i + k + halfLen] * curIm + im[i + k + halfLen] * curRe;
                re[i + k] = uRe + vRe;
                im[i + k] = uIm + vIm;
                re[i + k + halfLen] = uRe - vRe;
                im[i + k + halfLen] = uIm - vIm;
                const nextRe = curRe * wRe - curIm * wIm;
                curIm = curRe * wIm + curIm * wRe;
                curRe = nextRe;
            }
        }
    }
}

function nextPow2(n: number): number {
    let p = 1;
    while (p < n) p <<= 1;
    return p;
}

function magnitudeSpectrum(chunk: Float32Array): Float32Array {
    const n = nextPow2(chunk.length);
    const re = new Float32Array(n);
    const im = new Float32Array(n);
    for (let i = 0; i < chunk.length; i++) {
        const w = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (chunk.length - 1)));
        re[i] = chunk[i] * w;
    }
    fft(re, im);
    const half = n / 2;
    const mag = new Float32Array(half);
    for (let i = 0; i < half; i++) mag[i] = Math.sqrt(re[i] * re[i] + im[i] * im[i]);
    return mag;
}

// ── LOUDNESS (ITU-R BS.1770 approximation) ────────────────────

function calculateLoudness(channel: Float32Array, sampleRate: number): number {
    const blockSize = Math.floor(sampleRate * 0.4);
    const hopSize = Math.floor(sampleRate * 0.1);
    const absoluteGateSq = Math.pow(10, -70 / 10);
    const blockMSList: number[] = [];

    for (let start = 0; start + blockSize <= channel.length; start += hopSize) {
        let sum = 0;
        for (let i = start; i < start + blockSize; i++) sum += channel[i] * channel[i];
        const ms = sum / blockSize;
        if (ms > absoluteGateSq) blockMSList.push(ms);
    }

    if (blockMSList.length === 0) return -60;
    const ungatedMean = blockMSList.reduce((a, b) => a + b, 0) / blockMSList.length;
    const relativeGate = ungatedMean * Math.pow(10, -10 / 10);
    const gated = blockMSList.filter(ms => ms > relativeGate);
    const integrated = gated.length > 0 ? gated.reduce((a, b) => a + b, 0) / gated.length : ungatedMean;
    return Math.round(10 * Math.log10(integrated) * 10) / 10;
}

// ── TRUE PEAK ─────────────────────────────────────────────────

function calculateTruePeak(channel: Float32Array): number {
    let max = 0;
    for (let i = 0; i < channel.length; i++) {
        const abs = Math.abs(channel[i]);
        if (abs > max) max = abs;
    }
    return max === 0 ? -100 : Math.round(20 * Math.log10(max) * 100) / 100;
}

// ── DYNAMIC RANGE ─────────────────────────────────────────────

function calculateDynamicRange(channel: Float32Array, sampleRate: number): number {
    const blockSize = Math.floor(sampleRate * 3);
    const levels: number[] = [];
    for (let start = 0; start + blockSize <= channel.length; start += blockSize) {
        let sum = 0;
        for (let i = start; i < start + blockSize; i++) sum += channel[i] * channel[i];
        const rms = Math.sqrt(sum / blockSize);
        if (rms > 1e-6) levels.push(20 * Math.log10(rms));
    }
    if (levels.length < 2) return 0;
    levels.sort((a, b) => a - b);
    const lo = levels[Math.floor(levels.length * 0.1)];
    const hi = levels[Math.floor(levels.length * 0.95)];
    return Math.round((hi - lo) * 10) / 10;
}

// ── STEREO IMAGE ──────────────────────────────────────────────

function calculateStereoImage(left: Float32Array, right: Float32Array | null, sampleRate: number): { correlation: number; width: number } {
    if (!right) return { correlation: 1, width: 0 };
    const sectionLen = Math.min(sampleRate * 30, Math.floor(left.length / 2));
    const start = Math.max(0, Math.floor(left.length / 2) - sectionLen);
    const end = Math.min(left.length, start + sectionLen * 2);
    let sumLR = 0, sumLL = 0, sumRR = 0, sumDiff = 0, sumSum = 0;
    for (let i = start; i < end; i += 8) {
        const l = left[i], r = right[i];
        sumLR += l * r; sumLL += l * l; sumRR += r * r;
        const d = l - r, s = l + r;
        sumDiff += d * d; sumSum += s * s;
    }
    const denom = Math.sqrt(sumLL * sumRR);
    return {
        correlation: Math.round(Math.max(-1, Math.min(1, denom === 0 ? 0 : sumLR / denom)) * 100) / 100,
        width: Math.round(Math.min(1, sumSum === 0 ? 0 : sumDiff / sumSum) * 100) / 100,
    };
}

// ── SPECTRAL ANALYSIS (FFT-based) ─────────────────────────────

interface SpectralData {
    low: number; mid: number; high: number;
    character: string; brightness: string;
    spectralCentroid: number; spectralRolloff: number;
}

function analyzeSpectrum(channel: Float32Array, sampleRate: number): SpectralData {
    const frameLen = Math.min(channel.length, sampleRate * 4);
    const startSample = Math.max(0, Math.floor(channel.length / 2) - Math.floor(frameLen / 2));
    const chunk = channel.slice(startSample, startSample + frameLen);
    const fftSize = 2048;
    const half = fftSize / 2;
    const avgMag = new Float32Array(half);
    let frameCount = 0;
    for (let offset = 0; offset + fftSize <= chunk.length; offset += fftSize) {
        const mag = magnitudeSpectrum(chunk.slice(offset, offset + fftSize));
        for (let i = 0; i < half; i++) avgMag[i] += mag[i];
        frameCount++;
    }
    if (frameCount === 0) return { low: 33, mid: 34, high: 33, character: 'Balanced', brightness: 'Neutral', spectralCentroid: 1000, spectralRolloff: 4000 };
    for (let i = 0; i < half; i++) avgMag[i] /= frameCount;

    const binWidth = sampleRate / fftSize;
    const lowMax = Math.floor(250 / binWidth);
    const midMax = Math.floor(4000 / binWidth);
    const highMax = Math.min(half - 1, Math.floor(16000 / binWidth));
    let eLow = 0, eMid = 0, eHigh = 0, total = 0, wSum = 0;

    for (let i = 1; i <= highMax; i++) {
        const e = avgMag[i] * avgMag[i];
        const freq = i * binWidth;
        if (i <= lowMax) eLow += e;
        else if (i <= midMax) eMid += e;
        else eHigh += e;
        total += e;
        wSum += e * freq;
    }

    const spectralCentroid = total > 0 ? Math.round(wSum / total) : 1000;
    let rolloffHz = 0;
    const rolloffThreshold = total * 0.85;
    let cumE = 0;
    for (let i = 1; i <= highMax; i++) {
        cumE += avgMag[i] * avgMag[i];
        if (cumE >= rolloffThreshold) { rolloffHz = Math.round(i * binWidth); break; }
    }

    const totalBands = eLow + eMid + eHigh || 1;
    const lowPct = Math.round((eLow / totalBands) * 100);
    const midPct = Math.round((eMid / totalBands) * 100);
    const highPct = Math.round((eHigh / totalBands) * 100);

    let character = 'Balanced';
    if (lowPct > 55) character = 'Bass Heavy';
    else if (highPct > 45) character = 'Bright / Airy';
    else if (midPct > 50) character = 'Mid-Forward / Warm';
    else if (lowPct > 40 && midPct > 35) character = 'Full / Punchy';
    else if (highPct > 35 && midPct > 35) character = 'Crisp / Open';

    let brightness: string;
    if (spectralCentroid < 800) brightness = 'Very Dark / Deep';
    else if (spectralCentroid < 1500) brightness = 'Warm / Mellow';
    else if (spectralCentroid < 2500) brightness = 'Neutral / Balanced';
    else if (spectralCentroid < 4000) brightness = 'Bright / Crisp';
    else brightness = 'Very Bright / Airy';

    return { low: lowPct, mid: midPct, high: highPct, character, brightness, spectralCentroid, spectralRolloff: rolloffHz };
}

// ── BPM via AUTOCORRELATION ───────────────────────────────────

function calculateBPM(channel: Float32Array, sampleRate: number): number {
    const frameLen = Math.min(channel.length, sampleRate * 30);
    const startSample = Math.max(0, Math.floor(channel.length / 2) - Math.floor(frameLen / 2));
    const endSample = startSample + frameLen;
    const hopSamples = Math.floor(sampleRate * 0.01); // 10ms hop
    const hopRate = 1 / 0.01; // 100 Hz

    // Build onset strength envelope
    const envelope: number[] = [];
    for (let i = startSample; i + hopSamples < endSample; i += hopSamples) {
        let sum = 0;
        for (let j = i; j < i + hopSamples; j++) sum += channel[j] * channel[j];
        envelope.push(Math.sqrt(sum / hopSamples));
    }

    // Half-wave rectified first-order difference (onset detection)
    const diff = new Float32Array(envelope.length);
    for (let i = 1; i < envelope.length; i++) {
        diff[i] = Math.max(0, envelope[i] - envelope[i - 1]);
    }

    // Autocorrelation in BPM range 60-200
    const lagMin = Math.round(hopRate * 60 / 200);
    const lagMax = Math.round(hopRate * 60 / 60);
    const analysisLen = Math.min(diff.length, 1024);

    let bestLag = lagMin, bestCorr = -Infinity;
    for (let lag = lagMin; lag <= lagMax; lag++) {
        let corr = 0;
        for (let i = 0; i < analysisLen - lag; i++) corr += diff[i] * diff[i + lag];
        // Harmonic reinforcement at 2x tempo
        if (lag * 2 < diff.length) {
            let c2 = 0;
            for (let i = 0; i < Math.min(analysisLen - lag * 2, 512); i++) c2 += diff[i] * diff[i + lag * 2];
            corr += 0.4 * c2;
        }
        if (corr > bestCorr) { bestCorr = corr; bestLag = lag; }
    }

    let bpm = Math.round((hopRate * 60) / bestLag);
    while (bpm < 60) bpm *= 2;
    while (bpm > 200) bpm /= 2;
    return bpm;
}

// ── ENERGY LEVEL ──────────────────────────────────────────────

function classifyEnergy(loudnessDb: number): string {
    if (loudnessDb > -8) return 'Very High';
    if (loudnessDb > -14) return 'High';
    if (loudnessDb > -20) return 'Medium';
    if (loudnessDb > -28) return 'Low';
    return 'Very Low';
}

// ── TEMPO CHARACTER ───────────────────────────────────────────

function classifyTempoCharacter(bpm: number): string {
    if (bpm < 60) return 'Very Slow (Larghissimo)';
    if (bpm < 76) return 'Slow (Largo)';
    if (bpm < 108) return 'Moderate (Andante/Moderato)';
    if (bpm < 132) return 'Fast (Allegro)';
    if (bpm < 168) return 'Very Fast (Vivace/Presto)';
    return 'Extremely Fast (Prestissimo)';
}

// ── MAIN ──────────────────────────────────────────────────────

self.onmessage = (e: MessageEvent) => {
    const { leftChannel, rightChannel, sampleRate } = e.data;
    try {
        const loudnessDb = calculateLoudness(leftChannel, sampleRate);
        const truePeak = Math.max(calculateTruePeak(leftChannel), rightChannel ? calculateTruePeak(rightChannel) : -100);
        const dynamicRange = calculateDynamicRange(leftChannel, sampleRate);
        const stereo = calculateStereoImage(leftChannel, rightChannel, sampleRate);
        const spectral = analyzeSpectrum(leftChannel, sampleRate);
        const bpm = calculateBPM(leftChannel, sampleRate);
        const energy = classifyEnergy(loudnessDb);
        const tempoCharacter = classifyTempoCharacter(bpm);

        self.postMessage({
            type: 'success',
            result: { bpm, loudnessDb, truePeak, dynamicRange, stereo,
                balance: { low: spectral.low, mid: spectral.mid, high: spectral.high, character: spectral.character },
                brightness: spectral.brightness, spectralCentroid: spectral.spectralCentroid,
                spectralRolloff: spectral.spectralRolloff, energy, tempoCharacter },
        });
    } catch (err) {
        self.postMessage({ type: 'error', error: String(err) });
    }
};
