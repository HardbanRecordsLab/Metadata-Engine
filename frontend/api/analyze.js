
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/genai';

// Initialize Supabase
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// --- SIMPLE IN-MEMORY RATE LIMITER ---
const rateLimit = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_USER = 50;

const checkRateLimit = (userId) => {
    const now = Date.now();
    const userRecord = rateLimit.get(userId) || { count: 0, startTime: now };

    if (now - userRecord.startTime > RATE_LIMIT_WINDOW) {
        userRecord.count = 1;
        userRecord.startTime = now;
    } else {
        userRecord.count += 1;
    }
    rateLimit.set(userId, userRecord);
    return userRecord.count <= MAX_REQUESTS_PER_USER;
};

export const config = {
    api: {
        bodyParser: {
            sizeLimit: '4.5mb',
        },
    },
};

export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    try {
        // 1. Authentication
        const authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).json({ error: 'Missing Authorization header' });

        const token = authHeader.split(' ')[1];
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        if (!checkRateLimit(user.id)) return res.status(429).json({ error: 'Rate limit exceeded.' });

        const { provider, model, contents, config: genConfig } = req.body;

        // 2. Provider Routing
        switch (provider) {
            case 'gemini':
                return await handleGemini(res, model, contents, genConfig);

            case 'groq':
                return await handleGenericOpenAICompat(res, 'https://api.groq.com/openai/v1/chat/completions', process.env.GROQ_API_KEY, req.body);

            case 'cerebras':
                return await handleGenericOpenAICompat(res, 'https://api.cerebras.ai/v1/chat/completions', process.env.CEREBRAS_API_KEY, req.body);

            case 'xai':
                return await handleGenericOpenAICompat(res, 'https://api.x.ai/v1/chat/completions', process.env.XAI_API_KEY, req.body);

            case 'cohere':
                return await handleCohere(res, req.body);

            case 'huggingface':
                return await handleHuggingFace(res, req.body);

            case 'spotify':
                return await handleSpotify(res, req.body);

            default:
                return await handleGemini(res, model, contents, genConfig); // Default to Gemini
        }

    } catch (error) {
        console.error('Proxy Error:', error);
        return res.status(500).json({ error: error.message });
    }
}

// --- HANDLERS ---

async function handleGemini(res, model, contents, config) {
    const apiKey = process.env.GOOGLE_API_KEY || process.env.VITE_GOOGLE_API_KEY;
    if (!apiKey) throw new Error("Gemini API Key missing on server.");

    const genAI = new GoogleGenerativeAI(apiKey);

    let modelName = model || 'gemini-1.5-flash';
    // Fix for hallucinated/future models in remote
    if (modelName === 'gemini-3-flash-preview') {
        modelName = 'gemini-1.5-flash';
    }

    try {
        const generativeModel = genAI.getGenerativeModel({ model: modelName });
        const result = await generativeModel.generateContent({
            contents: contents,
            config: config
        });

        return res.status(200).json({
            text: result.response.text(),
            candidates: result.response.candidates
        });
    } catch (apiError) {
        console.error("Google API Error:", apiError);
        const status = apiError.status || 500;
        const message = apiError.message || "Unknown Gemini Error";
        return res.status(status).json({ error: message });
    }
}

async function handleGenericOpenAICompat(res, url, apiKey, body) {
    if (!apiKey) throw new Error("Provider API Key missing on server.");

    const payload = {
        model: body.model,
        messages: body.messages,
        temperature: body.temperature,
        max_tokens: body.max_tokens || body.max_completion_tokens,
        stream: body.stream || false,
        response_format: body.response_format
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`Provider API Error: ${err}`);
    }

    const data = await response.json();
    return res.status(200).json(data);
}

async function handleCohere(res, body) {
    const apiKey = process.env.COHERE_API_KEY;
    if (!apiKey) throw new Error("Cohere API Key missing on server.");

    const response = await fetch('https://api.cohere.com/v1/chat', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: JSON.stringify({
            model: body.model,
            message: body.message,
            temperature: body.temperature,
            connectors: body.connectors || []
        })
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`Cohere API Error: ${err}`);
    }

    const data = await response.json();
    return res.status(200).json(data);
}

async function handleHuggingFace(res, body) {
    const apiKey = process.env.HF_TOKEN || process.env.VITE_HF_TOKEN;
    if (!apiKey) throw new Error("HF_TOKEN missing on server.");

    const model = body.model || "mistralai/Mistral-Nemo-Instruct-2407";
    const url = `https://api-inference.huggingface.co/models/${model}`;
    const payload = body.payload || body;

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`Hugging Face API Error: ${err}`);
    }

    const data = await response.json();
    return res.status(200).json(data);
}

async function handleSpotify(res, body) {
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

    if (!clientId || !clientSecret) throw new Error("Spotify credentials missing on server.");

    // Token management logic...
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const authResponse = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${basicAuth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'grant_type=client_credentials'
    });

    if (!authResponse.ok) throw new Error("Failed to authenticate with Spotify API.");
    const authData = await authResponse.json();
    const token = authData.access_token;

    const { type, query, trackId } = body;
    let url = '';
    if (type === 'search') {
        url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=1`;
    } else if (type === 'features') {
        url = `https://api.spotify.com/v1/audio-features/${trackId}`;
    }

    const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`Spotify API Error: ${err}`);
    }

    const data = await response.json();
    return res.status(200).json(data);
}
