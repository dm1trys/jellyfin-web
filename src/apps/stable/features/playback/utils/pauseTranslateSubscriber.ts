import type { PlaybackManager } from 'components/playback/playbackmanager';
import type { PlayerPlugin } from 'types/plugin';
import { currentSettings } from 'scripts/settings/userSettings';

import { PlaybackSubscriber } from './playbackSubscriber';

const OVERLAY_CLASS = 'pauseTranslateOverlay';
const WORD_BUTTON_CLASS = `${OVERLAY_CLASS}-word`;
const WORD_BUTTON_ACTIVE_CLASS = `${WORD_BUTTON_CLASS}-active`;

type MockWordEntry = {
    lemma: string
    partOfSpeech: string
    contextualMeaning: string
    translations: string[]
};

const normalizeSubtitleText = (text: string) => text
    .replace(/<[^>]+>/g, ' ')
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n')
    .trim();

const tokenizeWords = (text: string) => (
    text.match(/[A-Za-zÀ-ÿ'-]+/g) || []
);

const titleCase = (value: string) => (
    value.charAt(0).toUpperCase() + value.slice(1)
);

const getSourceLanguage = () => {
    const language = currentSettings.pauseTranslateSourceLanguage();
    return typeof language === 'string' && language ? language : 'en';
};

const getTargetLanguage = () => {
    const language = currentSettings.pauseTranslateTargetLanguage();
    return typeof language === 'string' && language ? language : 'uk';
};

const inferPartOfSpeech = (word: string) => {
    const lower = word.toLowerCase();

    if (/(ing|ed)$/.test(lower)) return 'verb';
    if (/ly$/.test(lower)) return 'adverb';
    if (/(ous|ful|able|al|ive|less|ic)$/.test(lower)) return 'adjective';
    if (/(tion|ment|ness|ship|ity|er|or)$/.test(lower)) return 'noun';
    return 'word';
};

const buildMockWordEntry = (word: string): MockWordEntry => {
    const normalized = word.toLowerCase();
    const partOfSpeech = inferPartOfSpeech(normalized);

    return {
        lemma: normalized,
        partOfSpeech,
        contextualMeaning: `Context meaning: ${titleCase(normalized)}`,
        translations: [
            `${normalized} (main)`,
            `${normalized} (context)`,
            `${normalized} (literal)`
        ]
    };
};

class PauseTranslateSubscriber extends PlaybackSubscriber {
    private overlay?: HTMLDivElement;
    private originalNode?: HTMLDivElement;
    private translatedNode?: HTMLDivElement;
    private wordsNode?: HTMLDivElement;
    private inspectorNode?: HTMLDivElement;
    private inspectorWordNode?: HTMLDivElement;
    private inspectorPartOfSpeechNode?: HTMLDivElement;
    private inspectorContextNode?: HTMLDivElement;
    private inspectorTranslationsNode?: HTMLDivElement;
    private translationCache = new Map<string, string>();
    private wordEntryCache = new Map<string, MockWordEntry>();
    private lastVisibleSubtitleText = '';
    private lastRenderedSubtitleText = '';
    private activeRequestId = 0;
    private selectedWord?: string;

    constructor(playbackManager: PlaybackManager) {
        super(playbackManager);
        this.ensureOverlay();
    }

    private ensureOverlay() {
        if (this.overlay) {
            return;
        }

        this.overlay = document.createElement('div');
        this.overlay.className = `${OVERLAY_CLASS} hide`;

        this.originalNode = document.createElement('div');
        this.originalNode.className = `${OVERLAY_CLASS}-original`;

        this.translatedNode = document.createElement('div');
        this.translatedNode.className = `${OVERLAY_CLASS}-translated`;

        this.wordsNode = document.createElement('div');
        this.wordsNode.className = `${OVERLAY_CLASS}-words`;

        this.inspectorNode = document.createElement('div');
        this.inspectorNode.className = `${OVERLAY_CLASS}-inspector`;

        this.inspectorWordNode = document.createElement('div');
        this.inspectorWordNode.className = `${OVERLAY_CLASS}-inspector-word`;

        this.inspectorPartOfSpeechNode = document.createElement('div');
        this.inspectorPartOfSpeechNode.className = `${OVERLAY_CLASS}-inspector-pos`;

        this.inspectorContextNode = document.createElement('div');
        this.inspectorContextNode.className = `${OVERLAY_CLASS}-inspector-context`;

        this.inspectorTranslationsNode = document.createElement('div');
        this.inspectorTranslationsNode.className = `${OVERLAY_CLASS}-inspector-translations`;

        this.inspectorNode.append(
            this.inspectorWordNode,
            this.inspectorPartOfSpeechNode,
            this.inspectorContextNode,
            this.inspectorTranslationsNode
        );

        this.overlay.append(this.originalNode, this.translatedNode, this.wordsNode, this.inspectorNode);
        this.overlay.addEventListener('click', this.onOverlayClick.bind(this));
        document.body.appendChild(this.overlay);
    }

    private showOverlay(original: string, translated: string, tone: 'ready' | 'loading' | 'error' = 'ready') {
        this.ensureOverlay();
        if (!this.overlay || !this.originalNode || !this.translatedNode || !this.wordsNode) {
            return;
        }

        this.originalNode.textContent = original;
        this.translatedNode.textContent = translated;
        this.overlay.dataset.tone = tone;
        this.overlay.classList.remove('hide');
        this.renderWordButtons(original);

        if (!this.selectedWord) {
            const [ firstWord ] = tokenizeWords(original);
            this.selectedWord = firstWord;
        }

        this.renderWordInspector();
    }

    private hideOverlay() {
        if (this.overlay) {
            this.overlay.classList.add('hide');
        }
    }

    private renderWordButtons(original: string) {
        if (!this.wordsNode) {
            return;
        }

        this.wordsNode.innerHTML = '';

        for (const word of tokenizeWords(original)) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = WORD_BUTTON_CLASS;
            button.dataset.word = word;
            button.textContent = word;

            if (word === this.selectedWord) {
                button.classList.add(WORD_BUTTON_ACTIVE_CLASS);
            }

            this.wordsNode.appendChild(button);
        }
    }

    private renderWordInspector() {
        if (
            !this.selectedWord
            || !this.inspectorNode
            || !this.inspectorWordNode
            || !this.inspectorPartOfSpeechNode
            || !this.inspectorContextNode
            || !this.inspectorTranslationsNode
        ) {
            return;
        }

        const selectedWord = this.selectedWord;

        this.inspectorNode.classList.remove('hide');
        this.inspectorWordNode.textContent = selectedWord.toLowerCase();
        this.inspectorPartOfSpeechNode.textContent = 'loading';
        this.inspectorContextNode.textContent = 'Loading word details...';
        this.inspectorTranslationsNode.innerHTML = '';
        void this.loadWordInspectorEntry(selectedWord);
    }

    private renderWordInspectorEntry(entry: MockWordEntry) {
        if (
            !this.inspectorWordNode
            || !this.inspectorPartOfSpeechNode
            || !this.inspectorContextNode
            || !this.inspectorTranslationsNode
        ) {
            return;
        }

        this.inspectorWordNode.textContent = entry.lemma;
        this.inspectorPartOfSpeechNode.textContent = entry.partOfSpeech;
        this.inspectorContextNode.textContent = entry.contextualMeaning;
        this.inspectorTranslationsNode.innerHTML = '';

        for (const translation of entry.translations) {
            const chip = document.createElement('div');
            chip.className = `${OVERLAY_CLASS}-translation-chip`;
            chip.textContent = translation;
            this.inspectorTranslationsNode.appendChild(chip);
        }
    }

    private async loadWordInspectorEntry(word: string) {
        const sourceLanguage = getSourceLanguage();
        const targetLanguage = getTargetLanguage();
        const cacheKey = `${sourceLanguage}|${targetLanguage}|${word.toLowerCase()}`;

        if (this.wordEntryCache.has(cacheKey)) {
            this.renderWordInspectorEntry(this.wordEntryCache.get(cacheKey) as MockWordEntry);
            return;
        }

        try {
            const entry = await this.fetchWordInspectorEntry(word, sourceLanguage, targetLanguage);
            this.wordEntryCache.set(cacheKey, entry);

            if (this.selectedWord?.toLowerCase() === word.toLowerCase()) {
                this.renderWordInspectorEntry(entry);
            }
        } catch (error) {
            console.error('[PauseTranslateSubscriber] word inspector error', error);
            const fallbackEntry = buildMockWordEntry(word);
            this.wordEntryCache.set(cacheKey, fallbackEntry);
            if (this.selectedWord?.toLowerCase() === word.toLowerCase()) {
                this.renderWordInspectorEntry(fallbackEntry);
            }
        }
    }

    private async fetchWordInspectorEntry(word: string, sourceLanguage: string, targetLanguage: string) {
        const normalizedWord = word.toLowerCase();
        const translationVariantsPromise = this.fetchTranslationVariants(normalizedWord, sourceLanguage, targetLanguage);

        if (sourceLanguage !== 'en') {
            const fallbackEntry = buildMockWordEntry(normalizedWord);
            const translations = await translationVariantsPromise;
            fallbackEntry.translations = translations.length ? translations : fallbackEntry.translations;
            return fallbackEntry;
        }

        const dictionaryResponse = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(normalizedWord)}`);
        if (!dictionaryResponse.ok) {
            const fallbackEntry = buildMockWordEntry(normalizedWord);
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
            translations: translations.length ? translations : buildMockWordEntry(normalizedWord).translations
        };
    }

    private async fetchTranslationVariants(word: string, sourceLanguage: string, targetLanguage: string) {
        const url = new URL('https://api.mymemory.translated.net/get');
        url.searchParams.set('q', word);
        url.searchParams.set('langpair', `${sourceLanguage}|${targetLanguage}`);

        const response = await fetch(url.toString());
        if (!response.ok) {
            return [];
        }

        const payload = await response.json();
        const variants = [
            payload?.responseData?.translatedText,
            ...(payload?.matches || []).map((match: { translation?: string }) => match.translation)
        ]
            .filter(Boolean)
            .map((value: string) => value.trim())
            .filter((value: string, index: number, list: string[]) => list.indexOf(value) === index)
            .slice(0, 5);

        return variants;
    }

    private onOverlayClick(event: Event) {
        const target = event.target;
        if (!(target instanceof HTMLElement)) {
            return;
        }

        const wordButton = target.closest(`.${WORD_BUTTON_CLASS}`);
        if (!(wordButton instanceof HTMLButtonElement)) {
            return;
        }

        this.selectedWord = wordButton.dataset.word;
        this.renderWordButtons(this.originalNode?.textContent || '');
        this.renderWordInspector();
    }

    private getVisibleSubtitleText(player?: PlayerPlugin) {
        const subtitleText = player?.getVisibleSubtitleText?.() || '';
        return normalizeSubtitleText(subtitleText);
    }

    private async translateSubtitleText(text: string) {
        const sourceLanguage = getSourceLanguage();
        const targetLanguage = getTargetLanguage();

        if (this.translationCache.has(text)) {
            return this.translationCache.get(text) as string;
        }

        const url = new URL('https://api.mymemory.translated.net/get');
        url.searchParams.set('q', text);
        url.searchParams.set(
            'langpair',
            `${sourceLanguage}|${targetLanguage}`
        );

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

        this.translationCache.set(text, translated);
        return translated;
    }

    private async renderPauseOverlay(force = false) {
        const subtitleText = this.getVisibleSubtitleText(this.player) || this.lastVisibleSubtitleText;
        if (!subtitleText) {
            this.hideOverlay();
            return;
        }

        if (!force && subtitleText === this.lastRenderedSubtitleText && this.overlay && !this.overlay.classList.contains('hide')) {
            return;
        }

        this.lastRenderedSubtitleText = subtitleText;
        const requestId = ++this.activeRequestId;
        this.showOverlay(subtitleText, 'Translating...', 'loading');

        try {
            const translated = await this.translateSubtitleText(subtitleText);
            if (requestId !== this.activeRequestId) {
                return;
            }

            this.showOverlay(subtitleText, translated, 'ready');
        } catch (error) {
            console.error('[PauseTranslateSubscriber] translation error', error);
            if (requestId !== this.activeRequestId) {
                return;
            }

            this.showOverlay(subtitleText, 'Could not translate this subtitle right now.', 'error');
        }
    }

    private syncVisibleSubtitleText() {
        const subtitleText = this.getVisibleSubtitleText(this.player);
        if (subtitleText) {
            this.lastVisibleSubtitleText = subtitleText;
        }

        return subtitleText;
    }

    onPlayerChange() {
        this.lastVisibleSubtitleText = '';
        this.lastRenderedSubtitleText = '';
        this.selectedWord = undefined;
        this.hideOverlay();
    }

    onPlayerPause() {
        this.syncVisibleSubtitleText();
        void this.renderPauseOverlay();
    }

    onPlayerPlaybackStop() {
        this.lastVisibleSubtitleText = '';
        this.lastRenderedSubtitleText = '';
        this.selectedWord = undefined;
        this.hideOverlay();
    }

    onPlayerStopped() {
        this.lastVisibleSubtitleText = '';
        this.lastRenderedSubtitleText = '';
        this.selectedWord = undefined;
        this.hideOverlay();
    }

    onPlayerTimeUpdate() {
        const subtitleText = this.syncVisibleSubtitleText();
        if (!subtitleText) {
            return;
        }

        const state = this.player ? this.playbackManager.getPlayerState(this.player) : null;
        if (state?.PlayState?.IsPaused) {
            void this.renderPauseOverlay(true);
        }
    }

    onPlayerUnpause() {
        this.lastRenderedSubtitleText = '';
        this.selectedWord = undefined;
        this.hideOverlay();
    }
}

export const bindPauseTranslateSubscriber = (playbackManager: PlaybackManager) => new PauseTranslateSubscriber(playbackManager);
