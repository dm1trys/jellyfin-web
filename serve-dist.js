const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const https = require('node:https');

const distDir = path.join(__dirname, 'dist');
const port = Number(process.env.WEB_CLIENT_PORT || 8097);
const bindHost = process.env.BIND_HOST || '0.0.0.0';
const lookupTimeoutMs = 8000;
const wiktApiBaseUrl = (process.env.WIKTAPI_BASE_URL || 'https://api.wiktapi.dev').replace(/\/+$/, '');
const stanzaBaseUrl = (process.env.STANZA_BASE_URL || '').replace(/\/+$/, '');

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
    let normalized = pathname;

    if (normalized === '/' || normalized === '/web' || normalized === '/web/') {
        normalized = '/index.html';
    } else if (normalized.startsWith('/web/')) {
        normalized = normalized.slice('/web'.length);
    }

    const resolved = path.resolve(path.join(distDir, `.${normalized}`));
    if (!resolved.startsWith(distDir)) {
        return null;
    }

    return resolved;
};

const normalizeSubtitleText = (text) => text
    .replace(/\{\\[^}]+\}/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\r/g, '')
    .replace(/[\u200E\u200F\u202A-\u202E]/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n')
    .normalize('NFC')
    .trim();

const tokenizeWords = (text) => (
    text.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu) || []
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

const decodeHtmlEntities = (value) => value
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, '\'')
    .replace(/&#39;/gi, '\'')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, num) => String.fromCodePoint(parseInt(num, 10)));

const normalizeFetchedText = (value) => {
    const repaired = maybeRepairMojibake(value);
    if (typeof repaired !== 'string') {
        return repaired;
    }

    return decodeHtmlEntities(repaired)
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .normalize('NFC')
        .trim();
};

const uniqueValues = (values) => values
    .filter((value) => typeof value === 'string' && value.trim())
    .map((value) => value.trim())
    .filter((value, index, list) => list.indexOf(value) === index);

const isLowerCaseToken = (value) => typeof value === 'string' && value === value.toLocaleLowerCase('de-DE');

const GERMAN_FUNCTION_WORDS = new Set([
    'aber', 'als', 'am', 'an', 'auch', 'auf', 'aus', 'bei', 'bis', 'da', 'das', 'dem',
    'den', 'der', 'des', 'die', 'du', 'durch', 'ein', 'eine', 'einem', 'einen', 'einer',
    'er', 'es', 'euch', 'euer', 'für', 'gegen', 'habts', 'heute', 'hinter', 'ihr', 'ich',
    'ihm', 'im', 'in', 'ins', 'ist', 'ja', 'kein', 'keine', 'mein', 'mir', 'mit', 'nach',
    'nein', 'nicht', 'nur', 'ohne', 'sein', 'sie', 'so', 'über', 'um', 'und', 'uns', 'unter',
    'vom', 'von', 'vor', 'war', 'wegen', 'wir', 'zu', 'zum', 'zur'
]);

const GERMAN_PART_OF_SPEECH_HINTS = [
    { test: /\bgeschlechtswort\b|\bartikel\b/i, value: 'article' },
    { test: /\bpronomen\b/i, value: 'pronoun' },
    { test: /\bpräposition\b/i, value: 'preposition' },
    { test: /\bkonjunktion\b/i, value: 'conjunction' },
    { test: /\badverb/i, value: 'adverb' },
    { test: /\badjektiv/i, value: 'adjective' },
    { test: /\bverb/i, value: 'verb' }
];

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
        normalizeFetchedText(payload?.responseData?.translatedText),
        ...(payload?.matches || []).map((match) => normalizeFetchedText(match.translation))
    ]);

    if (sourceLanguage !== targetLanguage) {
        const distinctCandidate = candidates.find((candidate) => !isEffectivelySameText(sourceText, candidate));
        if (distinctCandidate) {
            return distinctCandidate;
        }
    }

    return candidates[0] || sourceText;
};

const getGermanLookupCandidates = (normalizedWord, originalToken = normalizedWord) => {
    const candidates = [];

    if (typeof originalToken === 'string' && originalToken.trim()) {
        candidates.push(originalToken.trim().normalize('NFC'));
    }

    candidates.push(normalizedWord);

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

const mapStanzaUposToPartOfSpeech = (upos) => {
    const labels = {
        ADJ: 'adjective',
        ADP: 'preposition',
        ADV: 'adverb',
        AUX: 'verb',
        CCONJ: 'conjunction',
        DET: 'article',
        INTJ: 'interjection',
        NOUN: 'noun',
        NUM: 'number',
        PART: 'particle',
        PRON: 'pronoun',
        PROPN: 'proper noun',
        SCONJ: 'conjunction',
        VERB: 'verb'
    };

    return labels[upos] || '';
};

const formatGermanMorphFeatureTag = (key, value) => {
    const valueLabels = {
        Acc: 'Akkusativ',
        Cmp: 'Komparativ',
        Dat: 'Dativ',
        Fem: 'Femininum',
        Fin: 'Finit',
        Gen: 'Genitiv',
        Imp: 'Imperativ',
        Ind: 'Indikativ',
        Inf: 'Infinitiv',
        Masc: 'Maskulinum',
        Neut: 'Neutrum',
        Nom: 'Nominativ',
        Part: 'Partizip',
        Past: 'Prateritum',
        Pos: 'Positiv',
        Plur: 'Plural',
        Pres: 'Prasens',
        Sing: 'Singular',
        Sup: 'Superlativ'
    };

    if (key === 'Person' && value) {
        return `${key}: ${value}`;
    }

    return valueLabels[value] || `${key}: ${value}`;
};

const getGermanMorphologyTags = (morphology) => {
    if (!morphology?.feats || typeof morphology.feats !== 'object') {
        return [];
    }

    return uniqueValues(
        Object.entries(morphology.feats).map(([key, value]) => formatGermanMorphFeatureTag(key, value))
    );
};

const inferGermanEntryPartOfSpeech = (entry, normalizedWord) => {
    const gloss = getFirstGloss(entry) || '';

    if (/1\.\s*person singular|2\.\s*person singular|3\.\s*person singular|akkusativ der zweiten person singular|bezeichnet die eigene person|personalpronomen/i.test(gloss)) {
        return 'pronoun';
    }

    if (/possessivpronomen/i.test(gloss)) {
        return 'article';
    }

    if (/ästhetisch|angenehme wirkung auf die sinne|angenehm, gut, anständig|ein hohes Gewicht habend|zu euch gehörig|euch gehörend|ähnlich sein|ähnlich werden|redensartlich für sehr/i.test(gloss)) {
        return 'adjective';
    }

    if (/in zeitlicher nähe erfolgend|in naher zukunft|in örtlicher nähe|unweit von/i.test(gloss)) {
        return 'adverb';
    }

    if (/ursprung räumlicher oder zeitlicher veränderung|herkunft|gegenstand der betrachtung|mit um, ohne, anstatt/i.test(gloss)) {
        return 'preposition';
    }

    if (/hilfsverb/i.test(gloss)) {
        return 'verb';
    }

    if (/en$/.test(normalizedWord) && /^[a-zäöüß].*[;,.]/i.test(gloss) && !/\bgenitiv\b|\bnominativ\b|\bdativ\b|\bakkusativ\b|\bdeklination\b/i.test(gloss)) {
        return 'verb';
    }

    for (const hint of GERMAN_PART_OF_SPEECH_HINTS) {
        if (hint.test.test(gloss)) {
            return hint.value;
        }
    }

    if (entry?.pos) {
        return entry.pos;
    }

    if (GERMAN_FUNCTION_WORDS.has(normalizedWord)) {
        if (['der', 'die', 'das', 'dem', 'den', 'des', 'ein', 'eine', 'einem', 'einen', 'einer'].includes(normalizedWord)) {
            return 'article';
        }
        if (['ich', 'du', 'er', 'sie', 'es', 'wir', 'ihr', 'euch', 'mir', 'ihm', 'uns', 'dich', 'mein', 'euer'].includes(normalizedWord)) {
            return 'pronoun';
        }
        if (['in', 'an', 'auf', 'aus', 'bei', 'für', 'gegen', 'mit', 'nach', 'ohne', 'über', 'um', 'unter', 'von', 'vor', 'zu', 'wegen'].includes(normalizedWord)) {
            return 'preposition';
        }
        if (['aber', 'als', 'auch', 'da', 'ja', 'nein', 'nur', 'so', 'und'].includes(normalizedWord)) {
            return 'conjunction';
        }
    }

    if (isLikelyGermanVerbForm(entry)) {
        return 'verb';
    }

    if (isLowerCaseToken(normalizedWord) && /(ig|lich|isch|sam|bar|los|haft|end|ern?|en)$/.test(normalizedWord)) {
        return 'adjective';
    }

    return inferPartOfSpeech(normalizedWord);
};

const getExpectedGermanFunctionWordPartOfSpeech = (normalizedWord) => {
    if (['der', 'die', 'das', 'dem', 'den', 'des', 'ein', 'eine', 'einem', 'einen', 'einer'].includes(normalizedWord)) {
        return 'article';
    }
    if (['ich', 'du', 'er', 'sie', 'es', 'wir', 'ihr', 'euch', 'mir', 'ihm', 'uns', 'dich', 'mein', 'euer'].includes(normalizedWord)) {
        return 'pronoun';
    }
    if (['in', 'an', 'auf', 'aus', 'bei', 'für', 'gegen', 'mit', 'nach', 'ohne', 'über', 'um', 'unter', 'von', 'vor', 'zu', 'wegen'].includes(normalizedWord)) {
        return 'preposition';
    }
    if (['aber', 'als', 'auch', 'da', 'ja', 'nein', 'nur', 'so', 'und'].includes(normalizedWord)) {
        return 'conjunction';
    }
    return null;
};

const isRepeatedDirectAddressToken = (phrase, originalToken) => {
    if (!phrase || !originalToken || !/^[A-ZÄÖÜ]/.test(originalToken)) {
        return false;
    }

    const escaped = originalToken.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`\\b${escaped}\\b\\s*,\\s*\\b${escaped}\\b\\s*,`, 'u').test(phrase);
};

const scoreGermanEntry = (entry, normalizedWord, originalToken, morphology = null, phrase = '') => {
    if (!entry?.senses?.length) {
        return Number.NEGATIVE_INFINITY;
    }

    const gloss = getFirstGloss(entry) || '';
    const firstSenseTags = entry.senses?.[0]?.tags || [];
    const baseWord = getGermanBaseWord(entry);
    const lowerCaseOriginal = isLowerCaseToken(originalToken || normalizedWord);
    const inferredPartOfSpeech = inferGermanEntryPartOfSpeech(entry, normalizedWord);
    const expectedFunctionWordPartOfSpeech = getExpectedGermanFunctionWordPartOfSpeech(normalizedWord);
    const expectedMorphPartOfSpeech = mapStanzaUposToPartOfSpeech(morphology?.upos);
    const repeatedDirectAddress = isRepeatedDirectAddressToken(phrase, originalToken);
    let score = 100;

    if (entry.pos) {
        score += 10;
    }

    if (gloss) {
        score += 10;
    }

    if (firstSenseTags.includes('colloquial')) {
        score -= 25;
    }

    if (firstSenseTags.includes('form-of')) {
        score -= 120;
    }

    if (baseWord && baseWord.toLocaleLowerCase('de-DE') !== normalizedWord) {
        score -= 80;
    }

    if (entry.pos === 'noun' && lowerCaseOriginal) {
        score -= 45;
    }

    if (entry.forms?.some((form) => form.article) && lowerCaseOriginal) {
        score -= 30;
    }

    if (GERMAN_FUNCTION_WORDS.has(normalizedWord) && entry.pos === 'noun') {
        score -= 35;
    }

    if (GERMAN_FUNCTION_WORDS.has(normalizedWord) && /\bfamilienname\b|\bnachname\b|\beigenname\b|\bvorname\b/i.test(gloss)) {
        score -= 120;
    }

    if (GERMAN_FUNCTION_WORDS.has(normalizedWord) && /\bgeograph/i.test(gloss)) {
        score -= 80;
    }

    if (lowerCaseOriginal && /\bfamilienname\b|\bnachname\b|\beigenname\b|\bvorname\b/i.test(gloss)) {
        score -= 90;
    }

    if (lowerCaseOriginal && /\bgeograph/i.test(gloss)) {
        score -= 70;
    }

    if (/\bhöhenzug\b|\bgemeinde\b|\bobayern\b|\bnordrhein-westfalen\b/i.test(gloss)) {
        score -= 140;
    }

    if (lowerCaseOriginal && entry.word && /^[A-ZÄÖÜ]/.test(entry.word) && entry.word !== titleCase(normalizedWord)) {
        score -= 85;
    }

    if (/\bgeschlechtswort\b|\bartikel\b|\bpronomen\b|\bpräposition\b|\bkonjunktion\b/i.test(gloss)) {
        score += 40;
    }

    if (expectedFunctionWordPartOfSpeech && inferredPartOfSpeech === expectedFunctionWordPartOfSpeech) {
        score += 90;
    }

    if (expectedMorphPartOfSpeech && inferredPartOfSpeech === expectedMorphPartOfSpeech) {
        score += 120;
    }

    if (expectedMorphPartOfSpeech === 'verb' && inferredPartOfSpeech !== 'verb') {
        score -= 130;
    }

    if (expectedMorphPartOfSpeech === 'verb' && !firstSenseTags.includes('form-of')) {
        score += 110;
    }

    if (expectedMorphPartOfSpeech === 'verb' && firstSenseTags.includes('form-of')) {
        score -= 40;
    }

    if (expectedMorphPartOfSpeech === 'noun' && inferredPartOfSpeech !== 'noun') {
        score -= 45;
    }

    if (expectedMorphPartOfSpeech === 'pronoun' && inferredPartOfSpeech === 'pronoun') {
        score += 140;
    }

    if (expectedMorphPartOfSpeech === 'pronoun' && inferredPartOfSpeech !== 'pronoun') {
        score -= 120;
    }

    if (expectedMorphPartOfSpeech === 'article' && inferredPartOfSpeech === 'article') {
        score += 110;
    }

    if (expectedMorphPartOfSpeech === 'article' && !/possessivpronomen|artikel|geschlechtswort/i.test(gloss) && !['article', 'pronoun'].includes(inferredPartOfSpeech)) {
        score -= 70;
    }

    if (expectedMorphPartOfSpeech === 'adverb' && inferredPartOfSpeech === 'adverb') {
        score += 80;
    }

    if (expectedMorphPartOfSpeech === 'adverb' && inferredPartOfSpeech !== 'adverb') {
        score -= 80;
    }

    if (lowerCaseOriginal && inferredPartOfSpeech === 'adjective') {
        score += 55;
    }

    if (lowerCaseOriginal && inferredPartOfSpeech === 'adverb') {
        score += 45;
    }

    if (lowerCaseOriginal && /\bnicht schwierig\b|\bausreichend\b|\bin jeder hinsicht\b|\bunmittelbar\b|\bsofort\b|\bald\b/i.test(gloss)) {
        score += 35;
    }

    if (lowerCaseOriginal && /\bin zeitlicher nähe\b|\bin naher zukunft\b|\bin örtlicher nähe\b|\bunweit von/i.test(gloss)) {
        score += 80;
    }

    if (/\bantiquiert(?:es)?\b/i.test(gloss)) {
        score -= 60;
    }

    if (/abermals, noch einmal|geschlossen|ein hohes Gewicht habend/i.test(gloss) && GERMAN_FUNCTION_WORDS.has(normalizedWord)) {
        score -= 40;
    }

    if (normalizedWord === 'zu' && /^geschlossen$/i.test(gloss)) {
        score -= 60;
    }

    if (normalizedWord === 'schwer' && /ein hohes Gewicht habend/i.test(gloss)) {
        score += 15;
    }

    if (normalizedWord === 'über' && /\bpräposition\b/i.test(gloss)) {
        score += 40;
    }

    if (expectedMorphPartOfSpeech === 'verb' && /\bimperativ\b|\bpräsens aktiv des verbs\b|\bform des verbs\b/i.test(gloss)) {
        score += 140;
    }

    if (expectedMorphPartOfSpeech === 'verb' && /\bkeine energie habend\b/i.test(gloss)) {
        score -= 170;
    }

    if (expectedMorphPartOfSpeech === 'noun' && /\bhaar\b|\bhornfäden\b|\bkörper von menschen und säugetieren\b/i.test(gloss)) {
        score += 140;
    }

    if (expectedMorphPartOfSpeech === 'pronoun' && /\bpersonalpronomen\b|\bbezeichnet die eigene person\b|\bakkusativ der zweiten person singular\b|\bersetzt eine zuvor benutzte nominalphrase\b/i.test(gloss)) {
        score += 160;
    }

    if (repeatedDirectAddress && /\bgewöhnliche feldsalat\b/i.test(gloss)) {
        score -= 220;
    }

    if (entry.word && entry.word.toLocaleLowerCase('de-DE') === normalizedWord) {
        score += 10;
    }

    return score;
};

const selectGermanEntry = (entries, normalizedWord, originalToken, morphology = null, phrase = '') => (
    (entries || [])
        .filter((candidate) => candidate?.senses?.length)
        .sort((left, right) => scoreGermanEntry(right, normalizedWord, originalToken, morphology, phrase) - scoreGermanEntry(left, normalizedWord, originalToken, morphology, phrase))[0]
);

const refineGermanEntryByPhrase = (entries, selectedEntry, normalizedWord, phrase) => {
    if (!selectedEntry || !Array.isArray(entries) || !phrase) {
        return selectedEntry;
    }

    const normalizedPhrase = phrase.toLocaleLowerCase('de-DE');

    if (normalizedWord === 'gleich' && /\b(geht|gehe|gehst|gehen|kommt|komme|kommst|kommen)\b.*\bgleich\b|\bgleich\b.*\b(los|wieder|vorbei|da)\b/.test(normalizedPhrase)) {
        const temporalEntry = entries.find((candidate) => {
            const gloss = getFirstGloss(candidate) || '';
            return /\bin zeitlicher nähe\b|\bin naher zukunft\b/i.test(gloss);
        });
        if (temporalEntry) {
            return temporalEntry;
        }
    }

    return selectedEntry;
};

const isProbablyTargetLanguageText = (value, sourceWord, targetLanguage) => {
    if (typeof value !== 'string') {
        return false;
    }

    const normalized = normalizeFetchedText(value);
    if (!normalized) {
        return false;
    }

    if (/<[^>]+>/.test(normalized)) {
        return false;
    }

    if (isEffectivelySameText(sourceWord, normalized)) {
        return false;
    }

    if (/[\"“”„<>]/.test(normalized)) {
        return false;
    }

    if (targetLanguage === 'uk') {
        if (!/[А-Яа-яІіЇїЄєҐґ]/.test(normalized)) {
            return false;
        }

        if (/[A-Za-z]{4,}/.test(normalized)) {
            return false;
        }
    }

    if (normalized.length > 48) {
        return false;
    }

    if ((normalized.match(/[.!?]/g) || []).length > 1) {
        return false;
    }

    return true;
};

const filterTranslationCandidates = (values, sourceWord, targetLanguage) => uniqueValues(values)
    .filter((value) => isProbablyTargetLanguageText(value, sourceWord, targetLanguage));

const getFirstGloss = (entry) => entry?.senses
    ?.flatMap((sense) => sense.glosses || [])
    ?.map((gloss) => normalizeFetchedText(gloss))
    ?.find(Boolean);

const getSenseAwareGermanTranslations = async (entry, targetLanguage, sourceWord) => {
    const glossaryTranslations = filterTranslationCandidates(
        (entry?.translations || [])
            .filter((translation) => translation.lang_code === targetLanguage)
            .map((translation) => normalizeFetchedText(translation.word)),
        sourceWord,
        targetLanguage
    );
    return glossaryTranslations;
};

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

const buildFallbackWordEntry = (word, options = {}) => {
    const normalized = word.toLowerCase();
    return {
        lemma: options.lemma || normalized,
        partOfSpeech: 'not found',
        contextualMeaning: options.contextualMeaning || 'Word not found.',
        translations: []
    };
};

const buildLookupFailedWordEntry = (word, options = {}) => {
    const normalized = word.toLowerCase();
    return {
        lemma: options.lemma || normalized,
        partOfSpeech: 'lookup failed',
        contextualMeaning: options.contextualMeaning || 'Lookup failed.',
        translations: []
    };
};

const isHttpStatusError = (error, statusCode) => Number(error?.statusCode) === Number(statusCode);

const fetchJson = (urlString) => new Promise((resolve, reject) => {
    const url = new URL(urlString);
    const transport = url.protocol === 'http:' ? http : https;
    const request = transport.get(url, {
        headers: {
            'User-Agent': 'jellyfin-pause-translate-dev-server'
        }
    }, (response) => {
        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => {
            const body = Buffer.concat(chunks).toString('utf8');
            if (response.statusCode < 200 || response.statusCode >= 300) {
                const error = new Error(`Request failed with ${response.statusCode}: ${urlString}`);
                error.statusCode = response.statusCode;
                error.url = urlString;
                error.responseBody = body;
                reject(error);
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
        request.destroy(new Error(`Request timed out: ${urlString}`));
    });
    request.on('error', reject);
});

const postJson = (urlString, body, headers = {}) => new Promise((resolve, reject) => {
    const url = new URL(urlString);
    const transport = url.protocol === 'http:' ? http : https;
    const payload = JSON.stringify(body);
    const request = transport.request({
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
                const error = new Error(`Request failed with ${response.statusCode}: ${urlString} ${rawBody}`);
                error.statusCode = response.statusCode;
                error.url = urlString;
                error.responseBody = rawBody;
                reject(error);
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

    const translatedText = normalizeFetchedText(payload?.translations?.[0]?.text);
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
            normalizeFetchedText(payload?.responseData?.translatedText),
            ...(payload?.matches || []).map((match) => normalizeFetchedText(match.translation))
        ]).slice(0, 5);
    } catch (error) {
        return [];
    }
};

const fetchStanzaAnalysis = async (text, sourceLanguage) => {
    if (!stanzaBaseUrl || sourceLanguage !== 'de') {
        return [];
    }

    try {
        const payload = await postJson(`${stanzaBaseUrl}/analyze`, {
            text,
            lang: sourceLanguage
        });
        return Array.isArray(payload?.tokens) ? payload.tokens : [];
    } catch (error) {
        return [];
    }
};

const fetchGermanExactEntry = async (word, originalToken = word, morphology = null, phrase = '') => {
    const payload = await fetchJson(`${wiktApiBaseUrl}/v1/de/word/${encodeURIComponent(word)}?lang=de`);
    const entry = selectGermanEntry(payload?.entries || [], word.toLocaleLowerCase('de-DE'), originalToken, morphology, phrase);
    return entry ? { payload, entry, resolvedWord: word } : null;
};

const fetchGermanSearchEntry = async (word, originalToken = word, morphology = null, phrase = '') => {
    const payload = await fetchJson(`${wiktApiBaseUrl}/v1/de/search?q=${encodeURIComponent(word)}&lang=de`);
    const results = Array.isArray(payload) ? payload : payload?.results || payload?.entries || [];
    const normalizedQuery = word.toLocaleLowerCase('de-DE');
    const preferStrictExactSearchMatch = isLowerCaseToken(originalToken || word);
    const bestMatch = results.find((result) => typeof result?.word === 'string' && result.word.toLocaleLowerCase('de-DE') === normalizedQuery)
        || (!preferStrictExactSearchMatch
            ? results.find((result) => typeof result?.word === 'string' && result?.pos !== 'phrase')
            : null)
        || results.find((result) => typeof result?.word === 'string');
    if (!bestMatch?.word) {
        return null;
    }

    if (preferStrictExactSearchMatch && bestMatch.word.toLocaleLowerCase('de-DE') !== normalizedQuery) {
        return null;
    }

    try {
        const exactMatch = await fetchGermanExactEntry(bestMatch.word, originalToken, morphology, phrase);
        return exactMatch ? { ...exactMatch, bestMatch } : { payload, entry: null, resolvedWord: bestMatch.word, bestMatch };
    } catch (error) {
        if (!isHttpStatusError(error, 404)) {
            throw error;
        }
        return { payload, entry: null, resolvedWord: bestMatch.word, bestMatch };
    }
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
    let lastLookupError = null;
    for (const { prefix, stem } of getGermanSeparablePrefixParts(word)) {
        try {
            const stemMatch = await fetchGermanExactEntry(stem, word);
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
            if (!isHttpStatusError(error, 404)) {
                lastLookupError = error;
            }
        }
    }

    if (lastLookupError) {
        throw lastLookupError;
    }

    return null;
};

const shouldTreatAsDirectAddressName = (phrase, originalToken, entry, morphology) => {
    if (!isRepeatedDirectAddressToken(phrase, originalToken)) {
        return false;
    }

    if (mapStanzaUposToPartOfSpeech(morphology?.upos) === 'proper noun') {
        return false;
    }

    const gloss = getFirstGloss(entry) || '';
    return /\bgewöhnliche feldsalat\b|\bessbar\b|\bpflanze\b|\bkräuterpflanze\b/i.test(gloss);
};

const shouldRejectMorphologyMismatchedEntry = (entry, originalToken, morphology) => {
    const expectedMorphPartOfSpeech = mapStanzaUposToPartOfSpeech(morphology?.upos);
    const inferredPartOfSpeech = inferGermanEntryPartOfSpeech(entry, (originalToken || '').toLocaleLowerCase('de-DE'));

    if (expectedMorphPartOfSpeech === 'noun' && /^[A-ZÄÖÜ]/.test(originalToken || '') && inferredPartOfSpeech === 'verb') {
        return true;
    }

    return false;
};

const fetchGermanWordEntry = async (word, targetLanguage, phrase, originalToken = word, morphology = null) => {
    const normalizedWord = word.toLowerCase();
    const lookupCandidates = getGermanLookupCandidates(
        normalizedWord,
        originalToken,
    ).concat(
        morphology?.lemma && typeof morphology.lemma === 'string'
            ? getGermanLookupCandidates(morphology.lemma.toLocaleLowerCase('de-DE'), morphology.lemma)
            : []
    ).filter((candidate, index, list) => list.indexOf(candidate) === index);
    const mayBeProperName = originalToken !== normalizedWord && /^[A-ZÄÖÜ]/.test(originalToken);

    let resolvedLookupWord = normalizedWord;
    let sourcePayload = { entries: [] };
    let sourceEntry;
    let separableVerbOverride = null;
    let searchHint = null;
    let lastLookupError = null;
    for (const candidate of lookupCandidates) {
        try {
            const exactMatch = await fetchGermanExactEntry(candidate, originalToken, morphology, phrase);
            if (exactMatch) {
                resolvedLookupWord = exactMatch.resolvedWord;
                sourcePayload = exactMatch.payload;
                sourceEntry = exactMatch.entry;
                break;
            }
        } catch (error) {
            if (!isHttpStatusError(error, 404)) {
                lastLookupError = error;
            }
        }
    }

    if (!sourceEntry) {
        try {
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
        } catch (error) {
            lastLookupError = error;
        }
    }

    if (!sourceEntry) {
        for (const candidate of lookupCandidates) {
            try {
                const searchMatch = await fetchGermanSearchEntry(candidate, originalToken, morphology, phrase);
                if (searchMatch) {
                    resolvedLookupWord = searchMatch.resolvedWord;
                    sourcePayload = searchMatch.payload;
                    sourceEntry = searchMatch.entry;
                    searchHint = searchMatch.bestMatch || null;
                    break;
                }
            } catch (error) {
                if (!isHttpStatusError(error, 404)) {
                    lastLookupError = error;
                }
            }
        }
    }

    const baseWord = getGermanBaseWord(sourceEntry);
    const separableVerb = separableVerbOverride || resolveGermanSeparableVerb(resolvedLookupWord, phrase, sourceEntry, baseWord);
    const preferredLookupWord = separableVerb?.combinedLemma || baseWord || resolvedLookupWord;

    let entry = sourceEntry || (sourcePayload?.entries || []).find((candidate) => candidate?.senses?.length);
    if (preferredLookupWord.toLowerCase() !== resolvedLookupWord) {
        try {
            const baseMatch = await fetchGermanExactEntry(preferredLookupWord, originalToken, morphology, phrase);
            entry = baseMatch?.entry || entry;
        } catch (error) {
            // Keep the source entry as fallback when combined lemma lookup fails.
        }
    }

    entry = refineGermanEntryByPhrase(sourcePayload?.entries || [], entry, normalizedWord, phrase);

    if (entry && shouldTreatAsDirectAddressName(phrase, originalToken, entry, morphology)) {
        const fallbackEntry = buildFallbackWordEntry(normalizedWord, {
            lemma: originalToken
        });
        fallbackEntry.partOfSpeech = 'not found';
        fallbackEntry.contextualMeaning = 'Word not found.';
        fallbackEntry.grammarTags = uniqueValues(getGermanMorphologyTags(morphology));
        return fallbackEntry;
    }

    if (entry && shouldRejectMorphologyMismatchedEntry(entry, originalToken, morphology)) {
        const fallbackEntry = buildFallbackWordEntry(normalizedWord, {
            lemma: originalToken
        });
        fallbackEntry.partOfSpeech = 'not found';
        fallbackEntry.contextualMeaning = 'Word not found.';
        fallbackEntry.grammarTags = uniqueValues(getGermanMorphologyTags(morphology));
        return fallbackEntry;
    }

    if (!entry) {
        if (lastLookupError) {
            const lookupErrorEntry = buildLookupFailedWordEntry(normalizedWord, {
                lemma: mayBeProperName ? originalToken : normalizedWord
            });
            if (separableVerb) {
                lookupErrorEntry.lemma = separableVerb.combinedLemma;
                lookupErrorEntry.grammarTags = [`Trennbar: ${separableVerb.prefix}-`];
            } else if (resolvedLookupWord !== normalizedWord) {
                lookupErrorEntry.lemma = resolvedLookupWord;
            }
            return lookupErrorEntry;
        }

        const fallbackEntry = buildFallbackWordEntry(normalizedWord, {
            lemma: morphology?.lemma || (mayBeProperName ? originalToken : normalizedWord)
        });
        if (separableVerb) {
            fallbackEntry.lemma = separableVerb.combinedLemma;
            fallbackEntry.grammarTags = [`Trennbar: ${separableVerb.prefix}-`];
        } else if (resolvedLookupWord !== normalizedWord) {
            fallbackEntry.lemma = resolvedLookupWord;
        }
        if (morphology?.upos) {
            fallbackEntry.grammarTags = uniqueValues([
                ...(fallbackEntry.grammarTags || []),
                ...getGermanMorphologyTags(morphology)
            ]);
        }
        return fallbackEntry;
    }

    const glossaryTranslations = await getSenseAwareGermanTranslations(entry, targetLanguage, preferredLookupWord);

    const partOfSpeech = mapStanzaUposToPartOfSpeech(morphology?.upos) || inferGermanEntryPartOfSpeech(entry, normalizedWord);
    const lemma = partOfSpeech === 'noun'
        ? getGermanLemma(entry, preferredLookupWord)
        : (entry?.word || morphology?.lemma || preferredLookupWord);

    return {
        lemma,
        partOfSpeech,
        contextualMeaning: getFirstGloss(entry) || `Kontextbedeutung: ${titleCase(preferredLookupWord)}`,
        translations: glossaryTranslations.slice(0, 5),
        grammarTags: uniqueValues([
            separableVerb ? `Trennbar: ${separableVerb.prefix}-` : undefined,
            ...getGermanGrammarTags(entry, sourceEntry),
            ...getGermanMorphologyTags(morphology)
        ])
    };
};

const buildInspectorByWord = async (tokens, phrase, sourceLanguage, targetLanguage) => {
    const inspectorByWord = {};
    const uniqueKeys = [];
    const originalTokensByKey = {};
    const morphologyTokens = await fetchStanzaAnalysis(phrase, sourceLanguage);
    const morphologyByKey = {};

    for (const token of tokens) {
        const key = token.toLowerCase();
        if (!uniqueKeys.includes(key)) {
            uniqueKeys.push(key);
        }
        if (!originalTokensByKey[key]) {
            originalTokensByKey[key] = token;
        }
    }

    for (const token of morphologyTokens) {
        const normalized = toTrimmedString(token?.text).toLocaleLowerCase('de-DE');
        if (normalized && !morphologyByKey[normalized]) {
            morphologyByKey[normalized] = token;
        }
    }

    const concurrency = 4;
    let cursor = 0;
    const worker = async () => {
        while (cursor < uniqueKeys.length) {
            const currentIndex = cursor++;
            const key = uniqueKeys[currentIndex];

            try {
                if (sourceLanguage === 'de') {
                    inspectorByWord[key] = await fetchGermanWordEntry(
                        key,
                        targetLanguage,
                        phrase,
                        originalTokensByKey[key],
                        morphologyByKey[key] || null
                    );
                } else {
                    inspectorByWord[key] = buildFallbackWordEntry(key);
                }
            } catch (error) {
                inspectorByWord[key] = buildLookupFailedWordEntry(key);
            }
        }
    };

    await Promise.all(
        Array.from({ length: Math.min(concurrency, uniqueKeys.length) }, () => worker())
    );

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

const getPauseTranslateRequestParams = (body) => {
    const phrase = normalizeSubtitleText(toTrimmedString(body.phrase || body.text));
    const sourceLanguage = toTrimmedString(body.sourceLanguage) || 'en';
    const targetLanguage = toTrimmedString(body.targetLanguage) || 'uk';

    return {
        phrase,
        sourceLanguage,
        targetLanguage
    };
};

http.createServer(async (request, response) => {
    if (request.method === 'POST' && request.url === '/api/pause-translate/translate') {
        try {
            const body = await readJsonBody(request);
            const { phrase, sourceLanguage, targetLanguage } = getPauseTranslateRequestParams(body);

            if (!phrase) {
                sendJson(response, 400, { error: 'Phrase is required' });
                return;
            }

            const tokens = tokenizeWords(phrase);
            const translatedText = await fetchTranslationText(phrase, sourceLanguage, targetLanguage);

            sendJson(response, 200, {
                translatedText,
                tokens
            });
        } catch (error) {
            sendJson(response, 502, {
                error: error instanceof Error ? error.message : 'Pause translate preview failed'
            });
        }
        return;
    }

    if (request.method === 'POST' && request.url === '/api/pause-translate/inspect') {
        try {
            const body = await readJsonBody(request);
            const { phrase, sourceLanguage, targetLanguage } = getPauseTranslateRequestParams(body);

            if (!phrase) {
                sendJson(response, 400, { error: 'Phrase is required' });
                return;
            }

            const tokens = tokenizeWords(phrase);
            const inspectorByWord = await buildInspectorByWord(tokens, phrase, sourceLanguage, targetLanguage);

            sendJson(response, 200, {
                inspectorByWord
            });
        } catch (error) {
            sendJson(response, 502, {
                error: error instanceof Error ? error.message : 'Pause translate analysis failed'
            });
        }
        return;
    }

    if ((request.url || '').startsWith('/api/')) {
        sendJson(response, 404, { error: 'Not found' });
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
