import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import Engine3Card from './Engine3Card';

const meta: any = {
    title: 'Ambion',
    trust: { score: 0.55, grade: 'C', needsReview: true, flags: ['genre:llm_vs_hearing'] },
    hearing: { genre: [{ label: 'techno', p: 0.5 }], mood: [{ label: 'dark', p: 0.3 }], instrument: [{ label: 'synthesizer', p: 0.4 }], vocal_verdict: { hasVocals: false } },
    tempoAnalysis: { bpm: 120, agreement: 1, alternatives: [] },
    syncReadiness: { score: 0.55, grade: 'C', ready: false, checks: [{ id: 'true_peak', ok: false, value: 0.3, note: 'x' }, { id: 'loudness', ok: true, value: -10 }] },
    passport: { alg: 'Ed25519', keyId: 'abc123', payload: {}, signature: 'sig' },
    genreCorrected: { from: 'Cinematic Neo-Soul', to: 'Cinematic Techno', reason: 'hearing' },
};

afterEach(() => vi.restoreAllMocks());

describe('Engine3Card', () => {
    it('renders nothing for analyses without Engine 3.0 data', () => {
        const { container } = render(<Engine3Card metadata={{ title: 'x' } as any} />);
        expect(container.innerHTML).toBe("");
    });

    it('shows the grade, flags, hearing, tempo, checks and the genre correction', () => {
        render(<Engine3Card metadata={meta} />);
        expect(screen.getByText(/Trust C · 55%/)).toBeTruthy();
        expect(screen.getByText(/Needs review/)).toBeTruthy();
        expect(screen.getByText(/disagree about the genre family/)).toBeTruthy();
        expect(screen.getByText(/techno 50%/)).toBeTruthy();
        expect(screen.getByText('120')).toBeTruthy();
        expect(screen.getByText(/true peak/)).toBeTruthy();
        expect(screen.getByText('Cinematic Techno')).toBeTruthy();
    });

    it('verifies the passport through the API', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: async () => ({ valid: true }) }));
        render(<Engine3Card metadata={meta} />);
        fireEvent.click(screen.getByText('Verify signature'));
        await waitFor(() => expect(screen.getByText(/Signature valid/)).toBeTruthy());
        expect((fetch as any).mock.calls[0][0]).toContain('/intelligence/passport/verify');
    });
});
