export type OverlayTone = 'ready' | 'loading' | 'error';

export type WordInspectorEntry = {
    lemma: string
    partOfSpeech: string
    contextualMeaning: string
    translations: string[]
    grammarTags?: string[]
};

export type WiktApiSense = {
    glosses?: string[]
    tags?: string[]
    form_of?: Array<{
        word?: string
    }>
};

export type WiktApiTranslation = {
    lang_code?: string
    word?: string
};

export type WiktApiForm = {
    form?: string
    article?: string
    tags?: string[]
};

export type WiktApiEntry = {
    word?: string
    pos?: string
    senses?: WiktApiSense[]
    translations?: WiktApiTranslation[]
    forms?: WiktApiForm[]
};
