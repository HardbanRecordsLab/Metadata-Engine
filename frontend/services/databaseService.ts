import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { AnalysisRecord, Metadata, UserTier } from '../types';

export const db = {
    // --- HISTORY ---
    fetchHistory: async (userId: string): Promise<AnalysisRecord[]> => {
        if (!isSupabaseConfigured || userId === 'guest-user-id') return [];
        const { data, error } = await supabase
            .from('analysis_history')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching history:', error);
            return [];
        }

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
    },

    saveAnalysis: async (userId: string, record: AnalysisRecord) => {
        if (!isSupabaseConfigured || userId === 'guest-user-id') return;

        const resultPayload = {
            metadata: record.metadata,
            inputType: record.inputType
        };

        const { error } = await supabase
            .from('analysis_history')
            .insert({
                user_id: userId,
                file_name: record.input.fileName || 'Unknown File',
                result: resultPayload,
                created_at: new Date().toISOString()
            });

        if (error) console.error('Error saving analysis:', error);
    },

    // --- PROFILES ---
    getProfile: async (userId: string) => {
        if (!isSupabaseConfigured || userId === 'guest-user-id') return null;
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

        if (error) {
            // New user without a profile might cause this, return null to signify not found
            if (error.code === 'PGRST116') return null; // No rows found
            console.error('Error fetching profile:', error);
            return null;
        }
        return data;
    },

    createProfile: async (userId: string, email: string, fullName: string, tier: UserTier, credits: number) => {
        if (!isSupabaseConfigured || userId === 'guest-user-id') return null;
        const { data, error } = await supabase
            .from('profiles')
            .insert({
                id: userId,
                email: email,
                full_name: fullName,
                tier: tier,
                credits: credits,
                test_code_used: false // New field for test code
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating profile:', error);
            throw error;
        }
        return data;
    },

    upgradeTier: async (userId: string, tier: string) => {
        if (!isSupabaseConfigured || userId === 'guest-user-id') return true;
        const { error } = await supabase
            .from('profiles')
            .update({ tier: tier })
            .eq('id', userId);

        if (error) throw error;
        return true;
    },

    updateCredits: async (userId: string, newCredits: number, testCodeUsed: boolean) => {
        if (!isSupabaseConfigured || userId === 'guest-user-id') return true;
        const { error } = await supabase
            .from('profiles')
            .update({ credits: newCredits, test_code_used: testCodeUsed })
            .eq('id', userId);

        if (error) throw error;
        return true;
    },

    decrementCredits: async (userId: string) => {
        if (!isSupabaseConfigured || userId === 'guest-user-id') return 0;
        const { data, error } = await supabase
            .rpc('decrement_user_credits', { user_id_param: userId }); // Use the RPC function

        if (error) {
            console.error('Error decrementing credits:', error);
            throw error;
        }
        return data; // Returns the new credit count
    }
};
