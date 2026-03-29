import type { WiktApiEntry, WordInspectorEntry } from './types';
import { getFirstGloss, getGermanBaseWord, getGermanGrammarTags, getGermanLemma } from './german';
import { inferPartOfSpeech, titleCase, uniqueValues } from './text';

const buildFallbackWordEntry = (word: string): WordInspectorEntry => {
    const normalized = word.toLowerCase();

    return {
        lemma: normalized,
        partOfSpeech: inferPartOfSpeech(normalized),
        contextualMeaning: `Context meaning: ${titleCase(normalized)}`,
        translations: [
            `${normalized} (main)`,
            `${normalized} (context)`,
            `${normalized} (literal)`
        ]
    };
};

const fetchTranslationVariants = async (word: string, sourceLanguage: string, targetLanguage: string) => {
    const url = new URL('https://api.mymemory.translated.net/get');
    url.searchParams.set('q', word);
    url.searchParams.set('langpair', `${sourceLanguage}|${targetLanguage}`);

    const response = await fetch(url.toString());
    if (!response.ok) {
        return [];
    }

    const payload = await response.json();
    return uniqueValues([
        payload?.responseData?.translatedText,
        ...(payload?.matches || []).map((match: { translation?: string }) => match.translation)
    ]).slice(0, 5);
};

const fetchEnglishWordEntry = async (
    normalizedWord: string,
    sourceLanguage: string,
    targetLanguage: string
) => {
    const translationVariantsPromise = fetchTranslationVariants(normalizedWord, sourceLanguage, targetLanguage);
    const dictionaryResponse = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(normalizedWord)}`);
    if (!dictionaryResponse.ok) {
        const fallbackEntry = buildFallbackWordEntry(normalizedWord);
        const translations = await translationVariantsPromise;
        fallbackEntry.translations = translations.length ? translations : fallbackEntry.translations;
        return fallbackEntry;
    }

    const dictionaryPayload = await dictionaryResponse.json();
    const entry = Array.isArray(dictionaryPayload) ? dictionaryPayload[0] : null;
    const firstMeaning = entry?.meanings?.[0];
    const firstDefinition = firstMeaning?.definitions?.[0]?.definition;
    const translations = await translationVariantsPromise;

    return {
        lemma: entry?.word || normalizedWord,
        partOfSpeech: firstMeaning?.partOfSpeech || inferPartOfSpeech(normalizedWord),
        contextualMeaning: firstDefinition || `Context meaning: ${titleCase(normalizedWord)}`,
        translations: translations.length ? translations : buildFallbackWordEntry(normalizedWord).translations
    };
};

const fetchGermanWordEntry = async (normalizedWord: string, targetLanguage: string) => {
    const translationVariantsPromise = fetchTranslationVariants(normalizedWord, 'de', targetLanguage);
    const sourceResponse = await fetch(`https://api.wiktapi.dev/v1/de/word/${encodeURIComponent(normalizedWord)}?lang=de`);
    if (!sourceResponse.ok) {
        const fallbackEntry = buildFallbackWordEntry(normalizedWord);
        const translations = await translationVariantsPromise;
        fallbackEntry.translations = translations.length ? translations : fallbackEntry.translations;
        return fallbackEntry;
    }

    const sourcePayload = await sourceResponse.json();
    const sourceEntry = (sourcePayload?.entries || []).find((candidate: WiktApiEntry) => candidate?.senses?.length) as WiktApiEntry | undefined;
    const baseWord = getGermanBaseWord(sourceEntry);

    let entry = (sourcePayload?.entries || []).find((candidate: WiktApiEntry) => candidate?.pos && candidate?.senses?.length) as WiktApiEntry | undefined;
    if (baseWord && baseWord.toLowerCase() !== normalizedWord) {
        const baseResponse = await fetch(`https://api.wiktapi.dev/v1/de/word/${encodeURIComponent(baseWord)}?lang=de`);
        if (baseResponse.ok) {
            const basePayload = await baseResponse.json();
            entry = (basePayload?.entries || []).find((candidate: WiktApiEntry) => candidate?.pos && candidate?.senses?.length) as WiktApiEntry | undefined;
        }
    }

    if (!entry) {
        const fallbackEntry = buildFallbackWordEntry(normalizedWord);
        const translations = await translationVariantsPromise;
        fallbackEntry.translations = translations.length ? translations : fallbackEntry.translations;
        return fallbackEntry;
    }

    const glossaryTranslations = uniqueValues(
        (entry.translations || [])
            .filter((translation) => translation.lang_code === targetLanguage)
            .map((translation) => translation.word)
    );
    const networkTranslations = await translationVariantsPromise;
    const translations = uniqueValues([
        ...glossaryTranslations,
        ...networkTranslations
    ]).slice(0, 5);

    return {
        lemma: getGermanLemma(entry, normalizedWord),
        partOfSpeech: entry.pos || inferPartOfSpeech(normalizedWord),
        contextualMeaning: getFirstGloss(entry) || `Kontextbedeutung: ${titleCase(normalizedWord)}`,
        translations: translations.length ? translations : buildFallbackWordEntry(normalizedWord).translations,
        grammarTags: getGermanGrammarTags(entry, sourceEntry)
    };
};

const fetchGenericWordEntry = async (normalizedWord: string, sourceLanguage: string, targetLanguage: string) => {
    const fallbackEntry = buildFallbackWordEntry(normalizedWord);
    const translations = await fetchTranslationVariants(normalizedWord, sourceLanguage, targetLanguage);
    fallbackEntry.translations = translations.length ? translations : fallbackEntry.translations;
    return fallbackEntry;
};

export const fetchWordInspectorEntry = (word: string, sourceLanguage: string, targetLanguage: string) => {
    const normalizedWord = word.toLowerCase();

    if (sourceLanguage === 'de') {
        return fetchGermanWordEntry(normalizedWord, targetLanguage);
    }

    if (sourceLanguage === 'en') {
        return fetchEnglishWordEntry(normalizedWord, sourceLanguage, targetLanguage);
    }

    return fetchGenericWordEntry(normalizedWord, sourceLanguage, targetLanguage);
};

export const translateSubtitleText = async (
    text: string,
    sourceLanguage: string,
    targetLanguage: string,
    translationCache: Map<string, string>
) => {
    if (translationCache.has(text)) {
        return translationCache.get(text) as string;
    }

    const url = new URL('https://api.mymemory.translated.net/get');
    url.searchParams.set('q', text);
    url.searchParams.set('langpair', `${sourceLanguage}|${targetLanguage}`);

    const response = await fetch(url.toString());
    if (!response.ok) {
        throw new Error(`Translation request failed with ${response.status}`);
    }

    const payload = await response.json();
    const translated = payload?.responseData?.translatedText
        || payload?.matches?.find((match: { translation?: string }) => match.translation)?.translation
        || '';

    if (!translated) {
        throw new Error('Translation provider returned an empty response');
    }

    translationCache.set(text, translated);
    return translated;
};
