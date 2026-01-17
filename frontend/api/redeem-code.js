import { createClient } from '@supabase/supabase-js';

// Initialize Supabase Admin Client (Service Role)
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    if (!supabaseServiceKey) {
        console.error('Missing SUPABASE_SERVICE_ROLE_KEY');
        return res.status(500).json({ error: 'Server Configuration Error' });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            persistSession: false,
        },
    });

    try {
        // 1. Authentication: Verify user via token
        const authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).json({ error: 'Missing Authorization header' });

        const token = authHeader.split(' ')[1];
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

        if (authError || !user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { code } = req.body;
        const userId = user.id;

        // 2. Define valid test codes and their grants
        const TEST_CODES = {
            'MMEFREE10': { credits: 10, tier: 'starter' } // Example test code: 10 free analyses for starter tier
        };

        const codeDetails = TEST_CODES[code.toUpperCase()];

        if (!codeDetails) {
            return res.status(400).json({ error: 'Invalid or expired code.' });
        }

        // 3. Check user's current profile
        const { data: profile, error: profileError } = await supabaseAdmin
            .from('profiles')
            .select('tier, credits, test_code_used')
            .eq('id', userId)
            .single();

        if (profileError || !profile) {
            console.error('Error fetching user profile:', profileError);
            return res.status(500).json({ error: 'Could not fetch user profile.' });
        }
        
        // 4. Validation rules
        if (profile.test_code_used) {
            return res.status(400).json({ error: 'Code already redeemed.' });
        }

        // 5. Apply code: Update credits and mark code as used
        const { error: updateError } = await supabaseAdmin
            .from('profiles')
            .update({ 
                credits: profile.credits + codeDetails.credits, 
                test_code_used: true,
                tier: codeDetails.tier // Ensure user is on starter tier to use test credits
            })
            .eq('id', userId);

        if (updateError) {
            console.error('Error updating user credits:', updateError);
            return res.status(500).json({ error: 'Failed to update user profile.' });
        }

        return res.status(200).json({ success: true, message: `Successfully redeemed code! ${codeDetails.credits} credits added.` });

    } catch (error) {
        console.error('Redeem Code API Error:', error);
        return res.status(500).json({ error: error.message });
    }
}