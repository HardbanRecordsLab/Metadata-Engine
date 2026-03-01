// api/validate.ts

/**
 * Serverless API endpoint that runs the internal validation bot and returns a JSON report.
 * Protected by a simple API key (VITE_VALIDATION_API_KEY) to avoid public abuse.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { runValidation } from '../services/validationBot';

// Simple in‑memory cache to avoid re‑running heavy checks on every request.
let cachedReport: { data: any; timestamp: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Only allow GET requests
    if (req.method !== 'GET') {
        res.status(405).json({ error: 'Method Not Allowed' });
        return;
    }

    const providedKey = req.headers['x-validation-key'] as string | undefined;
    const expectedKey = process.env.VITE_VALIDATION_API_KEY;
    if (!expectedKey || providedKey !== expectedKey) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    // Return cached result if still fresh
    if (cachedReport && Date.now() - cachedReport.timestamp < CACHE_TTL_MS) {
        res.status(200).json(cachedReport.data);
        return;
    }

    try {
        const report = await runValidation();
        cachedReport = { data: report, timestamp: Date.now() };
        res.status(200).json(report);
    } catch (err) {
        console.error('Validation bot error:', err);
        res.status(500).json({ error: 'Validation failed', details: err instanceof Error ? err.message : err });
    }
}
