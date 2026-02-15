
import { AnalysisRecord, Metadata, UserTier } from '../types';

const API_BASE = '/api';

const getHeaders = () => {
    const token = localStorage.getItem('access_token');
    return {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
    };
};

export const db = {
    // --- HISTORY ---
    fetchHistory: async (userId: string): Promise<AnalysisRecord[]> => {
        try {
            // Remove trailing slash to match backend legacy router
            const response = await fetch(`${API_BASE}/history`, {
                headers: getHeaders()
            });
            
            if (!response.ok) {
                console.error('Error fetching history:', response.statusText);
                return [];
            }

            const data = await response.json();

            // Map database columns to app types
            return data.map((row: any) => {
                const resultData = row.result || {};
                // Return mapped object
                return {
                    id: row.id,
                    metadata: resultData.metadata || {},
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
        } catch (error) {
            return null;
        }
    },

    createProfile: async (userId: string, email: string, fullName: string, tier: UserTier, credits: number) => {
        // Handled by registration endpoint in backend now.
        // This function is kept for interface compatibility but might be unused.
        return null; 
    },

    upgradeTier: async (userId: string, tier: string) => {
        // Not implemented in backend yet
        console.log("Upgrade tier to " + tier);
        return true;
    }
};
