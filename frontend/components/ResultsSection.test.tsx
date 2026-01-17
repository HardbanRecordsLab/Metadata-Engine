import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import ResultsSection from './results/ResultsSection';
import { Metadata } from '../types';

vi.mock('./IdentificationCard', () => ({ default: () => <div>IdentificationCard Mock</div> }));
vi.mock('./CreativeSuiteSidebar', () => ({ default: () => <div>CreativeSuiteSidebar Mock</div> }));
vi.mock('./TrackIdentityCard', () => ({
    default: ({ metadata, isEditing, onFieldUpdate }) => (
        <div>
            TrackIdentityCard Mock
            {isEditing ? (
                <input
                    data-testid="track-title-input"
                    value={metadata.title}
                    onChange={(e) => onFieldUpdate('title', e.target.value)}
                />
            ) : (
                <span>{metadata.title}</span>
            )}
        </div>
    )
}));
vi.mock('./SonicAnalysisDisplay', () => ({ default: () => <div>SonicAnalysisDisplay Mock</div> }));
vi.mock('./ClassificationStyleCard', () => ({ default: () => <div>ClassificationStyleCard Mock</div> }));
vi.mock('./CommercialLegalCard', () => ({ default: () => <div>CommercialLegalCard Mock</div> }));
vi.mock('./ConfidenceMeter', () => ({ default: () => <div>ConfidenceMeter Mock</div> }));


const mockMetadata: Metadata = {
    title: 'Test Song',
    artist: 'Test Artist',
    album: 'Test Album',
    year: '2024',
    mainInstrument: 'Guitar',
    key: 'Am',
    mode: 'Minor',
    bpm: 120,
    duration: 200,
    tempoCharacter: 'Upbeat',
    mainGenre: 'Rock',
    additionalGenres: ['Indie'],
    trackDescription: 'A cool rock song',
    keywords: ['rock', 'guitar'],
    energyLevel: 'High',
    moods: ['Energetic'],
    instrumentation: ['Electric Guitar', 'Drums'],
    copyright: '© 2024',
    publisher: 'Test Pub',
    isrc: 'US12345',
};

describe('ResultsSection Component', () => {
    const defaultProps = {
        isLoading: false,
        error: null,
        results: mockMetadata,
        onNewAnalysis: vi.fn(),
        showToast: vi.fn(),
        onUpdateResults: vi.fn(),
        currentAnalysis: { id: 'test-id', metadata: mockMetadata, inputType: 'file' as const, input: { fileName: 'test.mp3' } },
        uploadedFile: new File([], 'test.mp3', { type: 'audio/mpeg' }),
        theme: 'dark' as const,
        onBackToBatch: vi.fn(),
        userTier: 'starter' as const,
        onOpenPricing: vi.fn(),
    };

    beforeAll(() => {
        // Mock window.aistudio property
        Object.defineProperty(window, 'aistudio', {
            value: { hasSelectedApiKey: vi.fn().mockResolvedValue(true) },
            writable: true
        });
    });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders metadata correctly in view mode', () => {
        render(<ResultsSection {...defaultProps} />);

        expect(screen.getByText('Test Song')).toBeDefined();
        expect(screen.getByText('TrackIdentityCard Mock')).toBeDefined();
        expect(screen.getByText('SonicAnalysisDisplay Mock')).toBeDefined();
        expect(screen.getByText('ClassificationStyleCard Mock')).toBeDefined();
        expect(screen.getByText('CommercialLegalCard Mock')).toBeDefined();
        expect(screen.getByText('ConfidenceMeter Mock')).toBeDefined();
        expect(screen.getByText('IdentificationCard Mock')).toBeDefined();
        expect(screen.getByText('CreativeSuiteSidebar Mock')).toBeDefined();
    });

    it('toggles edit mode and allows field updates through TrackIdentityCard', async () => {
        render(<ResultsSection {...defaultProps} />);

        const editButton = screen.getByText('Edit');
        fireEvent.click(editButton);

        // In edit mode, TrackIdentityCard will show an input
        const titleInput = screen.getByTestId('track-title-input');
        fireEvent.change(titleInput, { target: { value: 'Updated Song' } });

        const saveButton = screen.getByText('Save Changes');
        fireEvent.click(saveButton);

        expect(defaultProps.onUpdateResults).toHaveBeenCalled();
        const updatedMetadata = (defaultProps.onUpdateResults.mock.calls[0][0] as Metadata);
        expect(updatedMetadata.title).toBe('Updated Song');
    });

    it('handles new analysis button click', () => {
        render(<ResultsSection {...defaultProps} />);
        const newAnalysisBtn = screen.getByText('New Analysis');
        fireEvent.click(newAnalysisBtn);
        expect(defaultProps.onNewAnalysis).toHaveBeenCalled();
    });

    it('displays error message when error prop is present', () => {
        render(<ResultsSection {...defaultProps} error="Test Error" results={null as any} />);
        expect(screen.getByText('Test Error')).toBeDefined();
    });
});