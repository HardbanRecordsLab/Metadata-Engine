
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import InputSection from './InputSection';
import { BatchItem } from '../types';

// Mock dependent components
vi.mock('./BatchQueueItem', () => ({
    default: ({ item }: { item: BatchItem }) => <div data-testid="batch-item">{item.file.name}</div>
}));

describe('InputSection Component', () => {
    const defaultProps = {
        batch: [],
        setBatch: vi.fn(),
        onAnalyze: vi.fn(),
        isProMode: false,
        setIsProMode: vi.fn(),
        isProcessingBatch: false,
        onViewResults: vi.fn(),
        onExportBatch: vi.fn(),
        showToast: vi.fn(),
        userTier: 'starter' as const,
        userCredits: 5,
        onOpenPricing: vi.fn(),
        onOpenCloudImport: vi.fn(),
        onOpenBulkEdit: vi.fn(),
    };

    it('renders upload area correctly', () => {
        render(<InputSection {...defaultProps} />);
        expect(screen.getByText(/Smart Analysis/i)).toBeDefined();
        expect(screen.getByText(/Drag & Drop/i)).toBeDefined();
    });

    it('displays batch items when batch is not empty', () => {
        const mockBatch: BatchItem[] = [
            { id: '1', file: new File([], 'song1.mp3'), status: 'pending' },
            { id: '2', file: new File([], 'song2.wav'), status: 'completed' }
        ];
        
        render(<InputSection {...defaultProps} batch={mockBatch} />);
        
        expect(screen.getByText(/Queue/)).toBeDefined();
        const items = screen.getAllByTestId('batch-item');
        expect(items).toHaveLength(2);
        expect(screen.getByText('song1.mp3')).toBeDefined();
        expect(screen.getByText('song2.wav')).toBeDefined();
    });

    it('disables Analyze button when processing', () => {
        render(<InputSection {...defaultProps} isProcessingBatch={true} batch={[{ id: '1', file: new File([], 's.mp3'), status: 'pending' }]} />);
        
        const analyzeBtn = screen.getByText(/Processing.../i);
        expect(analyzeBtn).toBeDefined();
        expect(analyzeBtn).toHaveProperty('disabled', true);
    });

    it('calls onAnalyze when button is clicked', () => {
        const mockBatch: BatchItem[] = [{ id: '1', file: new File([], 'song.mp3'), status: 'pending' }];
        
        render(<InputSection {...defaultProps} batch={mockBatch} />);
        
        const analyzeBtn = screen.getByText(/Analyze/i);
        fireEvent.click(analyzeBtn);
        
        expect(defaultProps.onAnalyze).toHaveBeenCalled();
    });

    it('toggles Pro mode', () => {
        render(<InputSection {...defaultProps} />);
        const toggle = screen.getByText(/Pro Mode/i);
        fireEvent.click(toggle);
        expect(defaultProps.setIsProMode).toHaveBeenCalledWith(true);
    });
});
