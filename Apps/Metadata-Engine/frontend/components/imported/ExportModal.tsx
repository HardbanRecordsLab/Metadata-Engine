import React, { useState } from 'react';

interface ExportModalProps {
    jobId: string;
    metadata: any;
    onClose: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = (props: ExportModalProps) => {
    const { jobId, metadata, onClose } = props;
    const [format, setFormat] = useState<'csv' | 'json' | 'cwr' | 'ddex'>('json');
    const [exporting, setExporting] = useState(false);

    const handleExport = async () => {
        setExporting(true);
        try {
            const formatMap = {
                csv: { endpoint: `/api/export/csv/${jobId}`, ext: 'csv' },
                json: { endpoint: `/api/export/json/${jobId}`, ext: 'json' },
                cwr: { endpoint: `/api/export/cwr/${jobId}`, ext: 'cwr' },
                ddex: { endpoint: `/api/export/ddex/${jobId}`, ext: 'xml' }
            } as const;

            const { endpoint, ext } = formatMap[format];
            const response = await fetch(endpoint);
            if (!response.ok) throw new Error(`Export failed: ${response.status}`);

            const blob = await response.blob();
            const downloadUrl = globalThis.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = `export_${jobId}.${ext}`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            globalThis.URL.revokeObjectURL(downloadUrl);

            onClose();
        } catch (error: any) {
            alert(`Export failed: ${error.message}`);
        } finally {
            setExporting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold">Export Analysis</h2>
                    <button onClick={onClose} aria-label="Close">×</button>
                </div>

                <div className="space-y-3 mb-6">
                    {(['csv', 'json', 'cwr', 'ddex'] as const).map((fmt) => (
                        <label key={fmt} className="flex items-center gap-3 p-3 border rounded cursor-pointer hover:bg-gray-50">
                            <input
                                type="radio"
                                name="format"
                                value={fmt}
                                checked={format === fmt}
                                onChange={(e) => setFormat(e.target.value as 'csv' | 'json' | 'cwr' | 'ddex')}
                            />
                            <div>
                                <p className="font-semibold">{fmt.toUpperCase()}</p>
                                <p className="text-xs text-gray-500">
                                    {fmt === 'csv' && 'Spreadsheet format'}
                                    {fmt === 'json' && 'Universal JSON format'}
                                    {fmt === 'cwr' && 'Music publishing standard'}
                                    {fmt === 'ddex' && 'Distribution standard'}
                                </p>
                            </div>
                        </label>
                    ))}
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-2 border rounded hover:bg-gray-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleExport}
                        disabled={exporting}
                        className="flex-1 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {exporting ? 'Exporting...' : 'Export'}
                    </button>
                </div>
            </div>
        </div>
    );
}
