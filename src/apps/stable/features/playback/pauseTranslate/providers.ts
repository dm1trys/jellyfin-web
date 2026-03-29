import type { PauseTranslateInspector, PauseTranslatePreview } from './types';

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

export const fetchPauseTranslationPreview = async (
    phrase: string,
    sourceLanguage: string,
    targetLanguage: string
) => {
    const request = await fetchJsonWithTimeout('/api/pause-translate/translate', {
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
        throw new Error(`Pause translate preview failed with ${request.status}`);
    }

    return request.json() as Promise<PauseTranslatePreview>;
};

export const fetchPauseTranslationInspector = async (
    phrase: string,
    sourceLanguage: string,
    targetLanguage: string
) => {
    const request = await fetchJsonWithTimeout('/api/pause-translate/inspect', {
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
        throw new Error(`Pause translate inspector failed with ${request.status}`);
    }

    return request.json() as Promise<PauseTranslateInspector>;
};
