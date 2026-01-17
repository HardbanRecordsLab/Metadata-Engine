
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Initialize Supabase Admin Client (Service Role)
// REQUIRED: Bypass RLS to update user profiles from the server
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://rasnxafddaznbzykgbbt.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; 

export const config = {
  api: {
    bodyParser: false, // We need raw body for signature verification
  },
};

// Helper to read raw body
async function getRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    if (!supabaseServiceKey) {
      console.error('Missing SUPABASE_SERVICE_ROLE_KEY');
      return res.status(500).json({ error: 'Server Configuration Error' });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // 1. Verify Signature
    const rawBody = await getRawBody(req);
    const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
    const hmac = crypto.createHmac('sha256', secret);
    const digest = Buffer.from(hmac.update(rawBody).digest('hex'), 'utf8');
    const signature = Buffer.from(req.headers['x-signature'] || '', 'utf8');

    if (!crypto.timingSafeEqual(digest, signature)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // 2. Parse Event
    const data = JSON.parse(rawBody.toString());
    const eventName = data.meta.event_name;
    const customData = data.meta.custom_data || {};
    const userId = customData.user_id;
    const variantId = data.data.attributes.variant_id; // Use this to identify plan

    console.log(`Webhook received: ${eventName} for user ${userId}`);

    if (!userId) {
        return res.status(400).json({ error: 'No user_id in custom_data' });
    }

    // 3. Map Lemon Squeezy Variants to App Tiers
    // TIP: In production, use your actual Variant IDs from Lemon Squeezy Dashboard
    // For now, we infer based on product name if available, or assume testing logic
    // You should Replace these IDs with your actual Lemon Squeezy Variant IDs
    
    // Logic: Update tier based on product name or variant match
    // Default fallback logic for simplicity in this template:
    const productName = data.data.attributes.product_name?.toLowerCase() || '';
    
    let newTier = 'starter';
    let newCredits = 1;

    if (productName.includes('hobby')) {
        newTier = 'hobby';
        newCredits = 50;
    } else if (productName.includes('basic')) {
        newTier = 'basic';
        newCredits = 120;
    } else if (productName.includes('pro')) {
        newTier = 'pro';
        newCredits = 260;
    } else if (productName.includes('studio')) {
        newTier = 'studio';
        newCredits = 999999; // Unlimited
    }

    // 4. Handle Specific Events
    if (eventName === 'subscription_created' || eventName === 'subscription_updated' || eventName === 'order_created') {
        
        // Update Supabase
        const { error } = await supabase
            .from('profiles')
            .update({ 
                tier: newTier,
                credits: newCredits 
            })
            .eq('id', userId);

        if (error) throw error;
        console.log(`Updated user ${userId} to ${newTier}`);

    } else if (eventName === 'subscription_cancelled' || eventName === 'subscription_expired') {
        
        // Downgrade to Starter
        const { error } = await supabase
            .from('profiles')
            .update({ 
                tier: 'starter',
                credits: 1 
            })
            .eq('id', userId);
            
        if (error) throw error;
        console.log(`Downgraded user ${userId} to starter`);
    }

    return res.status(200).json({ received: true });

  } catch (error) {
    console.error('Webhook Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
