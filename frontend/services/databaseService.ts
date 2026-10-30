
import { AnalysisRecord } from '../types';

const API_BASE = '/api';

const getHeaders = () => {
    const token = localStorage.getItem('hrl_sso_token_v3') || localStorage.getItem('access_token');
    return {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
    };
};

/**
 * A history row's `result` comes in two shapes: records saved by the browser are `{ metadata, inputType }`, records saved by the
 * backend when a job finishes (1720 of the 1723 rows on the admin account) ARE the metadata, at the top level. Reading only
 * `result.metadata` showed those rows with empty genre, BPM and key.
 */
export function metadataFromResult(result: any): AnalysisRecord['metadata'] {
    if (!result || typeof result !== 'object') return {} as AnalysisRecord['metadata'];
    if (result.metadata && typeof result.metadata === 'object') return result.metadata;
    return result as AnalysisRecord['metadata'];
}

export const db = {
    // --- HISTORY ---
    fetchHistory: async (userId: string): Promise<AnalysisRecord[]> => {
        try {
            const response = await fetch(`${API_BASE}/history`, {
                headers: getHeaders()
            });
            
            if (!response.ok) {
                console.error('Error fetching history:', response.status, response.statusText);
                return [];
            }

            const contentType = response.headers.get('content-type') || '';
            if (!contentType.includes('application/json')) {
                console.error('Error fetching history: expected JSON, got', contentType);
                return [];
            }

            const data = await response.json();

            // Map database columns to app types
            return data.map((row: any) => {
                const resultData = row.result || {};
                // Return mapped object
                return {
                    id: row.id,
                    metadata: metadataFromResult(resultData),
                    inputType: resultData.inputType || 'file',
                    input: {
                        fileName: row.file_name,
                        // description/link mapping if needed
                    },
                    createdAt: row.created_at
                };
            });
        } catch (error) {
            console.error('Error fetching history:', error);
            return [];
        }
    },

    saveAnalysis: async (userId: string, record: AnalysisRecord) => {
        try {
            const resultPayload = {
                metadata: record.metadata,
                inputType: record.inputType
            };

            await fetch(`${API_BASE}/history`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({
                    file_name: record.input.fileName || 'Unknown File',
                    result: resultPayload
                })
            });
        } catch (error) {
            console.error('Error saving analysis:', error);
        }
    },

    // --- PROFILES ---
    getProfile: async (userId: string) => {
        // This is now handled primarily by AuthContext calling /auth/me
        // But if needed:
        try {
            const response = await fetch(`${API_BASE}/auth/me`, {
                headers: getHeaders()
            });
            if (!response.ok) return null;
            return await response.json();
        } catch {
            return null;
        }
    },

};
