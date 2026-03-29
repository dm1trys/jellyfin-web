import type { WiktApiEntry } from './types';
import { titleCase, uniqueValues } from './text';

export const getFirstGloss = (entry?: WiktApiEntry) => entry?.senses
    ?.flatMap((sense) => sense.glosses || [])
    ?.find(Boolean);

export const getGermanBaseWord = (entry?: WiktApiEntry) => entry?.senses
    ?.flatMap((sense) => sense.form_of || [])
    ?.map((candidate) => candidate.word)
    ?.find(Boolean);

export const getGermanLemma = (entry: WiktApiEntry, normalizedWord: string) => {
    const lemma = entry.word || normalizedWord;
    const article = entry.forms
        ?.find((form) => form.tags?.includes('nominative') && form.tags?.includes('singular') && form.article)
        ?.article;

    return article ? `${article} ${lemma}` : lemma;
};

const getGermanPluralForm = (entry: WiktApiEntry) => entry.forms
    ?.find((form) => form.tags?.includes('nominative') && form.tags?.includes('plural'))
    ?.form;

const formatGermanGrammarTag = (tag: string) => {
    const labels: Record<string, string> = {
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

export const getGermanGrammarTags = (entry: WiktApiEntry, sourceEntry?: WiktApiEntry) => {
    const tags: string[] = [];
    const article = entry.forms
        ?.find((form) => form.tags?.includes('nominative') && form.tags?.includes('singular') && form.article)
        ?.article;
    const pluralForm = getGermanPluralForm(entry);
    const sourceSense = sourceEntry?.senses?.[0];

    if (article) {
        tags.push(article);
    }

    if (pluralForm && pluralForm !== entry.word) {
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
