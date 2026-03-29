import type { PauseTranslateAnalysis } from './types';

const LOOKUP_TIMEOUT_MS = 8000;

const fetchJsonWithTimeout = async (url: string, options?: RequestInit) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);

    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        return response;
    } finally {
        clearTimeout(timeoutId);
    }
};

export const analyzePauseTranslation = async (
    phrase: string,
    sourceLanguage: string,
    targetLanguage: string
) => {
    const request = await fetchJsonWithTimeout('/api/pause-translate/analyze', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            phrase,
            sourceLanguage,
            targetLanguage
        })
    });
    if (!request.ok) {
        throw new Error(`Pause translate analysis failed with ${request.status}`);
    }

    return request.json() as Promise<PauseTranslateAnalysis>;
};
