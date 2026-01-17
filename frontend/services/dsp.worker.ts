
// Native DSP Algorithms - Moved to Worker to prevent UI freezing

const calculateLoudness = (channelData: Float32Array, sampleRate: number): number => {
    let sum = 0;
    const samplesToAnalyze = Math.min(channelData.length, sampleRate * 60);
    
    for (let i = 0; i < samplesToAnalyze; i++) {
        sum += channelData[i] * channelData[i];
    }
    const rms = Math.sqrt(sum / samplesToAnalyze);
    const db = 20 * Math.log10(rms);
    return Math.round(db * 10) / 10;
};

const calculateTruePeak = (channelData: Float32Array): number => {
    let maxPeak = 0;
    for(let i = 0; i < channelData.length; i++) {
        const abs = Math.abs(channelData[i]);
        if(abs > maxPeak) maxPeak = abs;
    }
    if (maxPeak === 0) return -100;
    return Math.round(20 * Math.log10(maxPeak) * 100) / 100;
};

const calculateStereoImage = (left: Float32Array, right: Float32Array | null, sampleRate: number): { correlation: number, width: number } => {
    if (!right) return { correlation: 1, width: 0 };

    let sumLR = 0;
    let sumLL = 0;
    let sumRR = 0;
    let sumDiffSq = 0;
    let sumSumSq = 0;
    
    const start = Math.floor(left.length / 2) - (sampleRate * 15);
    const end = Math.floor(left.length / 2) + (sampleRate * 15);
    const actualStart = Math.max(0, start);
    const actualEnd = Math.min(left.length, end);

    for (let i = actualStart; i < actualEnd; i += 10) {
        const l = left[i];
        const r = right[i];
        
        sumLR += l * r;
        sumLL += l * l;
        sumRR += r * r;
        
        const diff = l - r;
        const sum = l + r;
        sumDiffSq += diff * diff;
        sumSumSq += sum * sum;
    }
    
    const denominator = Math.sqrt(sumLL * sumRR);
    const correlation = denominator === 0 ? 0 : sumLR / denominator;
    const width = sumSumSq === 0 ? 0 : sumDiffSq / sumSumSq;
    
    return {
        correlation: Math.round(correlation * 100) / 100,
        width: Math.min(1, Math.round(width * 100) / 100)
    };
};

const calculateSpectralBalance = (channelData: Float32Array, sampleRate: number): { low: number, mid: number, high: number, character: string } => {
    let totalLow = 0;
    let totalHigh = 0;
    
    const center = Math.floor(channelData.length / 2);
    const len = Math.min(sampleRate * 5, channelData.length);
    
    for (let i = center; i < center + len; i++) {
        const amp = Math.abs(channelData[i]);
        const diff = Math.abs(channelData[i] - (channelData[i-1] || 0));
        
        totalHigh += diff;
        totalLow += amp; 
    }
    
    totalHigh = totalHigh / len;
    totalLow = totalLow / len;
    
    const ratio = totalHigh / (totalLow || 0.001);
    
    let lowPct, midPct, highPct;
    let character = "Balanced";

    if (ratio < 0.05) { 
        lowPct = 70; midPct = 20; highPct = 10; character = "Bass Heavy";
    } else if (ratio < 0.15) { 
        lowPct = 40; midPct = 40; highPct = 20;
    } else { 
        lowPct = 20; midPct = 30; highPct = 50; character = "Bright / Airy";
    }
    
    return { low: lowPct, mid: midPct, high: highPct, character };
};

const calculateSpectralBrightness = (channelData: Float32Array, sampleRate: number): string => {
    let zeroCrossings = 0;
    const samplesToAnalyze = Math.min(channelData.length, sampleRate * 10);
    
    for (let i = 1; i < samplesToAnalyze; i++) {
        if ((channelData[i] >= 0 && channelData[i - 1] < 0) || 
            (channelData[i] < 0 && channelData[i - 1] >= 0)) {
            zeroCrossings++;
        }
    }
    
    const zcr = zeroCrossings / samplesToAnalyze;
    
    if (zcr < 0.02) return "Very Dark / Deep";
    if (zcr < 0.04) return "Warm / Mellow";
    if (zcr < 0.08) return "Neutral / Balanced";
    if (zcr < 0.15) return "Bright / Crisp";
    return "Very Bright / Harsh";
};

const calculateNativeBPM = (channelData: Float32Array, sampleRate: number): number => {
    const startSample = Math.floor(channelData.length / 3);
    const endSample = Math.floor((channelData.length / 3) * 2);
    let sumSq = 0;
    let count = 0;
    
    for(let i = startSample; i < endSample; i += 10) {
        sumSq += channelData[i] * channelData[i];
        count++;
    }
    const rms = Math.sqrt(sumSq / count);
    const threshold = Math.max(0.15, rms * 1.4); 

    const peaks = [];
    const minPeakDistance = sampleRate * 0.3;
    let lastPeakIndex = 0;

    for (let i = startSample; i < endSample; i++) {
        if (Math.abs(channelData[i]) > threshold) {
            if (i - lastPeakIndex > minPeakDistance) {
                peaks.push(i);
                lastPeakIndex = i;
            }
        }
    }

    if (peaks.length < 10) return 0;

    const intervals = [];
    for (let i = 1; i < peaks.length; i++) {
        intervals.push(peaks[i] - peaks[i - 1]);
    }

    const intervalCounts: { [key: number]: number } = {};
    intervals.forEach(interval => {
        const quantization = 500; 
        const rounded = Math.round(interval / quantization) * quantization; 
        intervalCounts[rounded] = (intervalCounts[rounded] || 0) + 1;
    });

    let maxCount = 0;
    let bestInterval = 0;
    for (const [interval, count] of Object.entries(intervalCounts)) {
        if (count > maxCount) {
            maxCount = count;
            bestInterval = Number(interval);
        }
    }

    if (bestInterval === 0) return 0;
    
    let bpm = 60 / (bestInterval / sampleRate);
    while (bpm < 70) bpm *= 2;
    while (bpm > 170) bpm /= 2;

    return Math.round(bpm);
};

self.onmessage = (e: MessageEvent) => {
    const { leftChannel, rightChannel, sampleRate } = e.data;
    
    try {
        // Run all calculations in this thread
        const bpm = calculateNativeBPM(leftChannel, sampleRate);
        const loudnessDb = calculateLoudness(leftChannel, sampleRate);
        const brightness = calculateSpectralBrightness(leftChannel, sampleRate);
        
        // Calculate Peak across all channels (simplified to left or max of both if right sent)
        const truePeakL = calculateTruePeak(leftChannel);
        const truePeakR = rightChannel ? calculateTruePeak(rightChannel) : -100;
        const truePeak = Math.max(truePeakL, truePeakR);

        const stereo = calculateStereoImage(leftChannel, rightChannel, sampleRate);
        const balance = calculateSpectralBalance(leftChannel, sampleRate);

        self.postMessage({
            type: 'success',
            result: {
                bpm,
                loudnessDb,
                brightness,
                truePeak,
                stereo,
                balance
            }
        });
    } catch (err) {
        self.postMessage({ type: 'error', error: err });
    }
};
