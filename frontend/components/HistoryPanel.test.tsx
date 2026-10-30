import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import HistoryPanel from './HistoryPanel';

/** pack a vector the way the backend does (L2-normalised float16, little-endian, base64) */
function pack(vec: number[]): string {
    const n = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
    const dv = new DataView(new ArrayBuffer(4));
    const half = (x: number) => {
        dv.setFloat32(0, x);
        const b = dv.getUint32(0);
        const sign = (b >> 16) & 0x8000;
        const exp = ((b >> 23) & 0xff) - 127 + 15;
        const frac = b & 0x7fffff;
        if (x === 0) return sign;
        if (exp <= 0) return sign;
        return sign | (exp << 10) | (frac >> 13);
    };
    const bytes: number[] = [];
    for (const v of vec) { const h = half(v / n); bytes.push(h & 0xff, h >> 8); }
    return btoa(String.fromCharCode(...bytes));
}

const rec = (id: string, name: string, vec: number[] | null): any => ({
    id, inputType: 'file', input: { fileName: name },
    metadata: { title: name, mainGenre: 'Techno', bpm: 124, key: 'A', mode: 'Minor', ...(vec ? { sonicVector: pack(vec) } : {}) },
});

const HISTORY = [
    rec('1', 'dark-techno.wav', [1, 0.05, 0]),
    rec('2', 'dark-techno-remaster.wav', [1, 0.052, 0]),
    rec('3', 'ambient-pad.wav', [0.02, 0.05, 1]),
    rec('4', 'old-analysis.wav', null),
];

afterEach(() => vi.restoreAllMocks());

describe('HistoryPanel: sound search over your own tracks', () => {
    it('says how many tracks can be searched by sound', () => {
        render(<HistoryPanel history={HISTORY} onSelectItem={() => {}} />);
        expect(screen.getByText(/3 of 4 tracks can be searched by sound/)).toBeTruthy();
    });

    it('ranks by the description using the backend text embedding', async () => {
        const fetchMock = vi.fn(async () => new Response(JSON.stringify({ vectors: [pack([1, 0, 0])] }), { status: 200 }));
        vi.stubGlobal('fetch', fetchMock);
        render(<HistoryPanel history={HISTORY} onSelectItem={() => {}} />);
        fireEvent.change(screen.getByPlaceholderText(/Describe the sound/), { target: { value: 'dark driving techno' } });
        fireEvent.click(screen.getByText('Search by sound'));
        await waitFor(() => expect(screen.getByText(/Sounds like “dark driving techno”/)).toBeTruthy());
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toBe('/api/intelligence/embed-text');
        const names = screen.getAllByTitle(/\.wav$/).map((e) => e.getAttribute('title'));
        expect(names.slice(0, 2).sort()).toEqual(['dark-techno-remaster.wav', 'dark-techno.wav']);
        expect(names[2]).toBe('ambient-pad.wav');
        expect(names).not.toContain('old-analysis.wav');                                  // no vector: not part of a sound search
        fireEvent.click(screen.getByText(/Back to history/));
        expect(screen.getAllByTitle(/\.wav$/).length).toBe(4);
    });

    it('shows a readable message when the model is not available', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 503 })));
        render(<HistoryPanel history={HISTORY} onSelectItem={() => {}} />);
        fireEvent.change(screen.getByPlaceholderText(/Describe the sound/), { target: { value: 'x' } });
        fireEvent.click(screen.getByText('Search by sound'));
        await waitFor(() => expect(screen.getByText(/starting up/)).toBeTruthy());
    });

    it('finds tracks similar to one of them, without a network call', () => {
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);
        render(<HistoryPanel history={HISTORY} onSelectItem={() => {}} />);
        fireEvent.click(screen.getAllByText('Similar')[0]);
        expect(screen.getByText(/Sounds like “dark-techno.wav”/)).toBeTruthy();
        expect(screen.getAllByTitle(/\.wav$/)[0].getAttribute('title')).toBe('dark-techno-remaster.wav');
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('groups the same recording under another name', () => {
        render(<HistoryPanel history={HISTORY} onSelectItem={() => {}} />);
        fireEvent.click(screen.getByText('Find duplicates'));
        expect(screen.getByText(/1 group\(s\) of the same recording/)).toBeTruthy();
        const group = screen.getByText(/Same recording, 2 analyses/).parentElement as HTMLElement;
        expect(within(group).getAllByTitle(/\.wav$/).length).toBe(2);
    });

    it('opens a track when it is clicked in the results', () => {
        const onSelect = vi.fn();
        render(<HistoryPanel history={HISTORY} onSelectItem={onSelect} />);
        fireEvent.click(screen.getAllByText('Similar')[0]);
        fireEvent.click(screen.getAllByTitle(/\.wav$/)[0]);
        expect(onSelect).toHaveBeenCalledTimes(1);
    });

    it('disables sound search when no analysis has a fingerprint', () => {
        render(<HistoryPanel history={[HISTORY[3]]} onSelectItem={() => {}} />);
        expect(screen.getByText(/0 of 1 tracks can be searched by sound/)).toBeTruthy();
        fireEvent.change(screen.getByPlaceholderText(/Describe the sound/), { target: { value: 'x' } });
        expect((screen.getByText('Search by sound') as HTMLButtonElement).disabled).toBe(true);
        expect((screen.getByText('Find duplicates') as HTMLButtonElement).disabled).toBe(true);
    });
});
