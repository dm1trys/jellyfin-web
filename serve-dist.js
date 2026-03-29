const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const https = require('node:https');

const distDir = path.join(__dirname, 'dist');
const port = Number(process.env.WEB_CLIENT_PORT || 8097);
const bindHost = process.env.BIND_HOST || '0.0.0.0';
const lookupTimeoutMs = 8000;

const contentTypes = {
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.ico': 'image/x-icon',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.map': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.txt': 'text/plain; charset=utf-8',
    '.wasm': 'application/wasm',
    '.webp': 'image/webp',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg'
};

const safeResolve = (requestPath) => {
    const pathname = decodeURIComponent(requestPath.split('?')[0]);
    const normalized = pathname === '/' ? '/index.html' : pathname;
    const resolved = path.resolve(path.join(distDir, `.${normalized}`));
    if (!resolved.startsWith(distDir)) {
        return null;
    }

    return resolved;
};

const normalizeSubtitleText = (text) => text
    .replace(/<[^>]+>/g, ' ')
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n')
    .normalize('NFC')
    .trim();

const tokenizeWords = (text) => (
    text.match(/[A-Za-zÀ-ÖØ-öø-ÿĀ-žẞЀ-ӿ'-]+/g) || []
);

const maybeRepairMojibake = (value) => {
    if (typeof value !== 'string') {
        return value;
    }

    // Heuristic for UTF-8 text that arrived decoded as latin1/win1252, e.g. "Ð¡Ñ..." or "Ã¶".
    if (!/[ÃÐÑ]/.test(value)) {
        return value;
    }

    try {
        const repaired = Buffer.from(value, 'latin1').toString('utf8');
        return repaired.includes('\uFFFD') ? value : repaired;
    } catch (error) {
        return value;
    }
};

const uniqueValues = (values) => values
    .filter((value) => typeof value === 'string' && value.trim())
    .map((value) => value.trim())
    .filter((value, index, list) => list.indexOf(value) === index);

const inferPartOfSpeech = (word) => {
    const lower = word.toLowerCase();

    if (/(ing|ed)$/.test(lower)) return 'verb';
    if (/ly$/.test(lower)) return 'adverb';
    if (/(ous|ful|able|al|ive|less|ic)$/.test(lower)) return 'adjective';
    if (/(tion|ment|ness|ship|ity|er|or)$/.test(lower)) return 'noun';
    return 'word';
};

const titleCase = (value) => (
    value.charAt(0).toUpperCase() + value.slice(1)
);

const SEPARABLE_PREFIXES = new Set([
    'ab', 'an', 'auf', 'aus', 'bei', 'da', 'dabei', 'daran', 'darauf', 'durch',
    'drauf', 'dran', 'drin', 'drüber', 'drum', 'drunter', 'ein', 'empor', 'entgegen',
    'entlang', 'fehl', 'fern', 'fest', 'fort', 'frei', 'gegenüber', 'gleich', 'heim',
    'her', 'hin', 'hoch', 'los', 'mit', 'nach', 'nieder', 'rauf', 'raus', 'rein',
    'rum', 'runter', 'rüber', 'statt', 'teil', 'tot', 'um', 'unter', 'vor', 'weg',
    'weiter', 'wieder', 'zu', 'zurück', 'zusammen'
]);

const toTrimmedString = (value) => (
    typeof value === 'string' ? value.trim() : ''
);

const deepLApiKey = toTrimmedString(process.env.DEEPL_API_KEY);
const deepLApiUrl = toTrimmedString(process.env.DEEPL_API_URL) || 'https://api-free.deepl.com/v2/translate';

const normalizeComparableText = (value) => toTrimmedString(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const isEffectivelySameText = (left, right) => (
    normalizeComparableText(left) === normalizeComparableText(right)
);

const getPreferredTranslation = (sourceText, sourceLanguage, targetLanguage, payload) => {
    const candidates = uniqueValues([
        maybeRepairMojibake(payload?.responseData?.translatedText),
        ...(payload?.matches || []).map((match) => maybeRepairMojibake(match.translation))
    ]);

    if (sourceLanguage !== targetLanguage) {
        const distinctCandidate = candidates.find((candidate) => !isEffectivelySameText(sourceText, candidate));
        if (distinctCandidate) {
            return distinctCandidate;
        }
    }

    return candidates[0] || sourceText;
};

const getGermanLookupCandidates = (normalizedWord) => {
    const candidates = [normalizedWord];

    // Subtitles often omit apostrophes in colloquial contractions, e.g. "habts" for "habt's".
    if (normalizedWord.endsWith('s') && normalizedWord.length > 3) {
        candidates.push(normalizedWord.slice(0, -1));
    }

    const capitalized = titleCase(normalizedWord);
    if (capitalized !== normalizedWord) {
        candidates.push(capitalized);
    }

    return uniqueValues(candidates);
};

const getFirstGloss = (entry) => entry?.senses
    ?.flatMap((sense) => sense.glosses || [])
    ?.find(Boolean);

const getGermanBaseWord = (entry) => entry?.senses
    ?.flatMap((sense) => sense.form_of || [])
    ?.map((candidate) => candidate.word)
    ?.find(Boolean);

const getGermanLemma = (entry, normalizedWord) => {
    const lemma = entry?.word || normalizedWord;
    const article = entry?.forms
        ?.find((form) => form.tags?.includes('nominative') && form.tags?.includes('singular') && form.article)
        ?.article;

    return article ? `${article} ${lemma}` : lemma;
};

const getGermanPluralForm = (entry) => entry?.forms
    ?.find((form) => form.tags?.includes('nominative') && form.tags?.includes('plural'))
    ?.form;

const formatGermanGrammarTag = (tag) => {
    const labels = {
        active: 'Aktiv',
        dative: 'Dativ',
        'form-of': 'Form',
        genitive: 'Genitiv',
        imperative: 'Imperativ',
        indicative: 'Indikativ',
        nominative: 'Nominativ',
        past: 'Prateritum',
        perfect: 'Perfekt',
        plural: 'Plural',
        present: 'Prasens',
        singular: 'Singular'
    };

    return labels[tag] || titleCase(tag);
};

const getGermanGrammarTags = (entry, sourceEntry) => {
    const tags = [];
    const article = entry?.forms
        ?.find((form) => form.tags?.includes('nominative') && form.tags?.includes('singular') && form.article)
        ?.article;
    const pluralForm = getGermanPluralForm(entry);
    const sourceSense = sourceEntry?.senses?.[0];

    if (article) {
        tags.push(article);
    }

    if (pluralForm && pluralForm !== entry?.word) {
        tags.push(`Plural: ${pluralForm}`);
    }

    for (const tag of sourceSense?.tags || []) {
        if (tag === 'form-of') {
            continue;
        }

        tags.push(formatGermanGrammarTag(tag));
    }

    return uniqueValues(tags).slice(0, 6);
};

const isLikelyGermanVerbForm = (entry) => (
    entry?.pos === 'verb'
    || entry?.senses?.some((sense) => sense.tags?.includes('present') || sense.tags?.includes('past') || sense.tags?.includes('imperative'))
);

const resolveGermanSeparableVerb = (normalizedWord, phrase, sourceEntry, baseWord) => {
    if (!phrase || !isLikelyGermanVerbForm(sourceEntry) || !baseWord || baseWord === normalizedWord) {
        return null;
    }

    const words = tokenizeWords(phrase).map((word) => word.toLowerCase());
    const selectedIndex = words.indexOf(normalizedWord);
    if (selectedIndex === -1) {
        return null;
    }

    for (let index = words.length - 1; index > selectedIndex; index--) {
        const candidatePrefix = words[index];
        if (!SEPARABLE_PREFIXES.has(candidatePrefix)) {
            continue;
        }

        return {
            combinedLemma: `${candidatePrefix}${baseWord}`,
            prefix: candidatePrefix
        };
    }

    return null;
};

const buildFallbackWordEntry = (word) => {
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

const fetchJson = (url) => new Promise((resolve, reject) => {
    const request = https.get(url, {
        headers: {
            'User-Agent': 'jellyfin-pause-translate-dev-server'
        }
    }, (response) => {
        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => {
            const body = Buffer.concat(chunks).toString('utf8');
            if (response.statusCode < 200 || response.statusCode >= 300) {
                reject(new Error(`Request failed with ${response.statusCode}: ${url}`));
                return;
            }

            try {
                resolve(JSON.parse(body));
            } catch (error) {
                reject(error);
            }
        });
    });

    request.setTimeout(lookupTimeoutMs, () => {
        request.destroy(new Error(`Request timed out: ${url}`));
    });
    request.on('error', reject);
});

const postJson = (urlString, body, headers = {}) => new Promise((resolve, reject) => {
    const url = new URL(urlString);
    const payload = JSON.stringify(body);
    const request = https.request({
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port,
        path: `${url.pathname}${url.search}`,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload),
            'User-Agent': 'jellyfin-pause-translate-dev-server',
            ...headers
        }
    }, (response) => {
        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => {
            const rawBody = Buffer.concat(chunks).toString('utf8');
            if (response.statusCode < 200 || response.statusCode >= 300) {
                reject(new Error(`Request failed with ${response.statusCode}: ${urlString} ${rawBody}`));
                return;
            }

            try {
                resolve(JSON.parse(rawBody));
            } catch (error) {
                reject(error);
            }
        });
    });

    request.setTimeout(lookupTimeoutMs, () => {
        request.destroy(new Error(`Request timed out: ${urlString}`));
    });
    request.on('error', reject);
    request.write(payload);
    request.end();
});

const toDeepLLanguageCode = (language) => {
    const normalized = toTrimmedString(language).replace('-', '_').toUpperCase();
    if (!normalized) {
        return '';
    }

    if (normalized === 'EN_GB' || normalized === 'EN_US') {
        return normalized;
    }

    const [baseLanguage] = normalized.split('_');
    return baseLanguage;
};

const fetchTranslationTextWithMyMemory = async (text, sourceLanguage, targetLanguage) => {
    const url = new URL('https://api.mymemory.translated.net/get');
    url.searchParams.set('q', text);
    url.searchParams.set('langpair', `${sourceLanguage}|${targetLanguage}`);

    const payload = await fetchJson(url.toString());
    return getPreferredTranslation(text, sourceLanguage, targetLanguage, payload);
};

const fetchTranslationTextWithDeepL = async (text, sourceLanguage, targetLanguage) => {
    if (!deepLApiKey) {
        return null;
    }

    const sourceLang = toDeepLLanguageCode(sourceLanguage);
    const targetLang = toDeepLLanguageCode(targetLanguage);
    if (!sourceLang || !targetLang || sourceLang === targetLang) {
        return null;
    }

    const payload = await postJson(
        deepLApiUrl,
        {
            text: [text],
            source_lang: sourceLang,
            target_lang: targetLang
        },
        {
            Authorization: `DeepL-Auth-Key ${deepLApiKey}`
        }
    );

    const translatedText = maybeRepairMojibake(payload?.translations?.[0]?.text);
    return translatedText && !isEffectivelySameText(text, translatedText) ? translatedText : null;
};

const fetchTranslationText = async (text, sourceLanguage, targetLanguage) => {
    if (sourceLanguage === targetLanguage) {
        return text;
    }

    try {
        const deepLTranslation = await fetchTranslationTextWithDeepL(text, sourceLanguage, targetLanguage);
        if (deepLTranslation) {
            return deepLTranslation;
        }
    } catch (error) {
        // Fall back to MyMemory when DeepL is unavailable or the language pair is unsupported.
    }

    return fetchTranslationTextWithMyMemory(text, sourceLanguage, targetLanguage);
};

const fetchTranslationVariants = async (word, sourceLanguage, targetLanguage) => {
    const url = new URL('https://api.mymemory.translated.net/get');
    url.searchParams.set('q', word);
    url.searchParams.set('langpair', `${sourceLanguage}|${targetLanguage}`);

    try {
        const payload = await fetchJson(url.toString());
        return uniqueValues([
            maybeRepairMojibake(payload?.responseData?.translatedText),
            ...(payload?.matches || []).map((match) => maybeRepairMojibake(match.translation))
        ]).slice(0, 5);
    } catch (error) {
        return [];
    }
};

const fetchGermanExactEntry = async (word) => {
    const payload = await fetchJson(`https://api.wiktapi.dev/v1/de/word/${encodeURIComponent(word)}?lang=de`);
    const entry = (payload?.entries || []).find((candidate) => candidate?.senses?.length);
    return entry ? { payload, entry, resolvedWord: word } : null;
};

const fetchGermanSearchEntry = async (word) => {
    const payload = await fetchJson(`https://api.wiktapi.dev/v1/de/search?q=${encodeURIComponent(word)}&lang=de`);
    const results = Array.isArray(payload) ? payload : payload?.results || payload?.entries || [];
    const bestMatch = results.find((result) => typeof result?.word === 'string');
    if (!bestMatch?.word) {
        return null;
    }

    return fetchGermanExactEntry(bestMatch.word);
};

const getGermanSeparablePrefixParts = (word) => {
    const prefixes = Array.from(SEPARABLE_PREFIXES)
        .filter((prefix) => word.startsWith(prefix) && word.length > prefix.length)
        .sort((left, right) => right.length - left.length);

    return prefixes.map((prefix) => ({
        prefix,
        stem: word.slice(prefix.length)
    }));
};

const fetchGermanSeparableStemEntry = async (word) => {
    for (const { prefix, stem } of getGermanSeparablePrefixParts(word)) {
        try {
            const stemMatch = await fetchGermanExactEntry(stem);
            if (!stemMatch) {
                continue;
            }

            const baseWord = getGermanBaseWord(stemMatch.entry);
            if (!baseWord) {
                continue;
            }

            return {
                prefix,
                stem,
                entry: stemMatch.entry,
                payload: stemMatch.payload,
                resolvedWord: stemMatch.resolvedWord,
                combinedLemma: `${prefix}${baseWord}`
            };
        } catch (error) {
            // Keep searching through possible stems.
        }
    }

    return null;
};

const fetchGermanWordEntry = async (word, targetLanguage, phrase) => {
    const normalizedWord = word.toLowerCase();
    const lookupCandidates = getGermanLookupCandidates(normalizedWord);

    let resolvedLookupWord = normalizedWord;
    let sourcePayload = { entries: [] };
    let sourceEntry;
    let separableVerbOverride = null;
    for (const candidate of lookupCandidates) {
        try {
            const exactMatch = await fetchGermanExactEntry(candidate);
            if (exactMatch) {
                resolvedLookupWord = exactMatch.resolvedWord;
                sourcePayload = exactMatch.payload;
                sourceEntry = exactMatch.entry;
                break;
            }
        } catch (error) {
            // Continue trying normalized lookup candidates when a colloquial form is missing.
        }
    }

    if (!sourceEntry) {
        const separableStemMatch = await fetchGermanSeparableStemEntry(normalizedWord);
        if (separableStemMatch) {
            resolvedLookupWord = separableStemMatch.resolvedWord;
            sourcePayload = separableStemMatch.payload;
            sourceEntry = separableStemMatch.entry;
            separableVerbOverride = {
                combinedLemma: separableStemMatch.combinedLemma,
                prefix: separableStemMatch.prefix
            };
        }
    }

    if (!sourceEntry) {
        for (const candidate of lookupCandidates) {
            try {
                const searchMatch = await fetchGermanSearchEntry(candidate);
                if (searchMatch) {
                    resolvedLookupWord = searchMatch.resolvedWord;
                    sourcePayload = searchMatch.payload;
                    sourceEntry = searchMatch.entry;
                    break;
                }
            } catch (error) {
                // Keep falling back until candidates are exhausted.
            }
        }
    }

    const baseWord = getGermanBaseWord(sourceEntry);
    const separableVerb = separableVerbOverride || resolveGermanSeparableVerb(resolvedLookupWord, phrase, sourceEntry, baseWord);
    const preferredLookupWord = separableVerb?.combinedLemma || baseWord || resolvedLookupWord;

    let entry = (sourcePayload?.entries || []).find((candidate) => candidate?.senses?.length);
    if (preferredLookupWord.toLowerCase() !== resolvedLookupWord) {
        try {
            const baseMatch = await fetchGermanExactEntry(preferredLookupWord);
            entry = baseMatch?.entry || entry;
        } catch (error) {
            // Keep the source entry as fallback when combined lemma lookup fails.
        }
    }

    const translationVariants = await fetchTranslationVariants(preferredLookupWord, 'de', targetLanguage);
    if (!entry) {
        const fallbackEntry = buildFallbackWordEntry(normalizedWord);
        fallbackEntry.translations = translationVariants.length ? translationVariants : fallbackEntry.translations;
        if (separableVerb) {
            fallbackEntry.lemma = separableVerb.combinedLemma;
            fallbackEntry.grammarTags = [`Trennbar: ${separableVerb.prefix}-`];
        } else if (resolvedLookupWord !== normalizedWord) {
            fallbackEntry.lemma = resolvedLookupWord;
        }
        return fallbackEntry;
    }

    const glossaryTranslations = uniqueValues(
        (entry.translations || [])
            .filter((translation) => translation.lang_code === targetLanguage)
            .map((translation) => maybeRepairMojibake(translation.word))
    );

    return {
        lemma: getGermanLemma(entry, preferredLookupWord),
        partOfSpeech: entry.pos || (isLikelyGermanVerbForm(entry) ? 'verb' : inferPartOfSpeech(preferredLookupWord)),
        contextualMeaning: getFirstGloss(entry) || `Kontextbedeutung: ${titleCase(preferredLookupWord)}`,
        translations: uniqueValues([
            ...glossaryTranslations,
            ...translationVariants
        ]).slice(0, 5),
        grammarTags: uniqueValues([
            separableVerb ? `Trennbar: ${separableVerb.prefix}-` : undefined,
            ...getGermanGrammarTags(entry, sourceEntry)
        ])
    };
};

const buildInspectorByWord = async (tokens, phrase, sourceLanguage, targetLanguage) => {
    const inspectorByWord = {};

    for (const token of tokens) {
        const key = token.toLowerCase();
        if (inspectorByWord[key]) {
            continue;
        }

        try {
            if (sourceLanguage === 'de') {
                inspectorByWord[key] = await fetchGermanWordEntry(key, targetLanguage, phrase);
            } else {
                const fallbackEntry = buildFallbackWordEntry(key);
                const translations = await fetchTranslationVariants(key, sourceLanguage, targetLanguage);
                fallbackEntry.translations = translations.length ? translations : fallbackEntry.translations;
                inspectorByWord[key] = fallbackEntry;
            }
        } catch (error) {
            inspectorByWord[key] = buildFallbackWordEntry(key);
        }
    }

    return inspectorByWord;
};

const readJsonBody = (request) => new Promise((resolve, reject) => {
    const chunks = [];
    request.on('data', (chunk) => chunks.push(chunk));
    request.on('end', () => {
        try {
            const body = Buffer.concat(chunks).toString('utf8');
            resolve(body ? JSON.parse(body) : {});
        } catch (error) {
            reject(error);
        }
    });
    request.on('error', reject);
});

const sendJson = (response, statusCode, payload) => {
    response.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store'
    });
    response.end(JSON.stringify(payload));
};

const sendFile = (response, filePath) => {
    fs.readFile(filePath, (error, data) => {
        if (error) {
            response.writeHead(500);
            response.end('Internal Server Error');
            return;
        }

        const ext = path.extname(filePath).toLowerCase();
        response.writeHead(200, {
            'Content-Type': contentTypes[ext] || 'application/octet-stream',
            'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable'
        });
        response.end(data);
    });
};

http.createServer(async (request, response) => {
    if (request.method === 'POST' && request.url === '/api/pause-translate/analyze') {
        try {
            const body = await readJsonBody(request);
            const phrase = normalizeSubtitleText(toTrimmedString(body.phrase));
            const sourceLanguage = toTrimmedString(body.sourceLanguage) || 'en';
            const targetLanguage = toTrimmedString(body.targetLanguage) || 'uk';

            if (!phrase) {
                sendJson(response, 400, { error: 'Phrase is required' });
                return;
            }

            const tokens = tokenizeWords(phrase);
            const translatedText = await fetchTranslationText(phrase, sourceLanguage, targetLanguage);
            const inspectorByWord = await buildInspectorByWord(tokens, phrase, sourceLanguage, targetLanguage);

            sendJson(response, 200, {
                translatedText,
                tokens,
                inspectorByWord
            });
        } catch (error) {
            sendJson(response, 502, {
                error: error instanceof Error ? error.message : 'Pause translate analysis failed'
            });
        }
        return;
    }

    const resolvedPath = safeResolve(request.url || '/');
    if (!resolvedPath) {
        response.writeHead(403);
        response.end('Forbidden');
        return;
    }

    fs.stat(resolvedPath, (error, stats) => {
        if (!error && stats.isFile()) {
            sendFile(response, resolvedPath);
            return;
        }

        sendFile(response, path.join(distDir, 'index.html'));
    });
}).listen(port, bindHost, () => {
    console.log(`Serving Jellyfin web client at http://${bindHost}:${port}`);
});
