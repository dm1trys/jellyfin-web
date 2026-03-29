import type { PlaybackManager } from 'components/playback/playbackmanager';
import type { PlayerPlugin } from 'types/plugin';
import { currentSettings } from 'scripts/settings/userSettings';

import { PlaybackSubscriber } from '../utils/playbackSubscriber';
import { PauseTranslateOverlay } from './overlay';
import { fetchPauseTranslationInspector, fetchPauseTranslationPreview } from './providers';
import { normalizeSubtitleText, tokenizeWords } from './text';
import type { PauseTranslateInspector, PauseTranslatePreview } from './types';

const getSourceLanguage = () => {
    const language = currentSettings.pauseTranslateSourceLanguage();
    return typeof language === 'string' && language ? language : 'en';
};

const getTargetLanguage = () => {
    const language = currentSettings.pauseTranslateTargetLanguage();
    return typeof language === 'string' && language ? language : 'uk';
};

class PauseTranslateSubscriber extends PlaybackSubscriber {
    private readonly overlay: PauseTranslateOverlay;
    private previewCache = new Map<string, PauseTranslatePreview>();
    private inspectorCache = new Map<string, PauseTranslateInspector>();
    private lastVisibleSubtitleText = '';
    private lastRenderedSubtitleText = '';
    private activeRequestId = 0;
    private selectedWord?: string;
    private currentInspector?: PauseTranslateInspector;

    constructor(playbackManager: PlaybackManager) {
        super(playbackManager);
        this.overlay = new PauseTranslateOverlay((word) => {
            this.selectedWord = word;
            this.overlay.setSelectedWord(word);
            this.renderWordInspector();
        });
    }

    private hideOverlay() {
        this.overlay.hide();
    }

    private renderWordInspector() {
        if (!this.selectedWord) {
            return;
        }

        const entry = this.currentInspector?.inspectorByWord[this.selectedWord.toLowerCase()];
        if (entry) {
            this.overlay.renderInspectorEntry(entry);
            return;
        }

        this.overlay.renderInspectorLoading(this.selectedWord);
    }

    private getVisibleSubtitleText(player?: PlayerPlugin) {
        const subtitleText = player?.getVisibleSubtitleText?.() || '';
        return normalizeSubtitleText(subtitleText);
    }

    private async renderPauseOverlay(force = false) {
        const subtitleText = this.getVisibleSubtitleText(this.player) || this.lastVisibleSubtitleText;
        if (!subtitleText) {
            this.hideOverlay();
            return;
        }

        if (!force && subtitleText === this.lastRenderedSubtitleText) {
            return;
        }

        const sourceLanguage = getSourceLanguage();
        const targetLanguage = getTargetLanguage();
        const cacheKey = `${sourceLanguage}|${targetLanguage}|${subtitleText}`;
        this.lastRenderedSubtitleText = subtitleText;
        const requestId = ++this.activeRequestId;
        this.overlay.show(subtitleText, 'Translating...', 'loading');

        const words: string[] = tokenizeWords(subtitleText);
        if (!this.selectedWord || !words.includes(this.selectedWord)) {
            this.selectedWord = words[0];
            this.overlay.setSelectedWord(this.selectedWord);
        }
        this.overlay.renderInspectorLoading(this.selectedWord || '');

        try {
            const preview = this.previewCache.has(cacheKey)
                ? this.previewCache.get(cacheKey) as PauseTranslatePreview
                : await fetchPauseTranslationPreview(subtitleText, sourceLanguage, targetLanguage);
            if (requestId !== this.activeRequestId) {
                return;
            }

            this.previewCache.set(cacheKey, preview);
            this.currentInspector = this.inspectorCache.get(cacheKey);
            this.overlay.show(subtitleText, preview.translatedText, 'ready');
            this.overlay.setSelectedWord(this.selectedWord);
            this.renderWordInspector();
        } catch (error) {
            console.error('[PauseTranslateSubscriber] translation error', error);
            if (requestId !== this.activeRequestId) {
                return;
            }

            this.currentInspector = undefined;
            this.overlay.show(subtitleText, 'Could not translate this subtitle right now.', 'error');
            this.overlay.setSelectedWord(this.selectedWord);
            if (this.selectedWord) {
                this.overlay.renderInspectorError(this.selectedWord, 'Word details could not be loaded right now.');
            }
            return;
        }

        try {
            const inspector = this.inspectorCache.has(cacheKey)
                ? this.inspectorCache.get(cacheKey) as PauseTranslateInspector
                : await fetchPauseTranslationInspector(subtitleText, sourceLanguage, targetLanguage);
            if (requestId !== this.activeRequestId) {
                return;
            }

            this.inspectorCache.set(cacheKey, inspector);
            this.currentInspector = inspector;
            this.renderWordInspector();
        } catch (error) {
            console.error('[PauseTranslateSubscriber] inspector error', error);
            if (requestId !== this.activeRequestId) {
                return;
            }

            this.currentInspector = undefined;
            if (this.selectedWord) {
                this.overlay.renderInspectorError(this.selectedWord, 'Word details could not be loaded right now.');
            }
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
        this.currentInspector = undefined;
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
        this.currentInspector = undefined;
        this.selectedWord = undefined;
        this.hideOverlay();
    }

    onPlayerStopped() {
        this.lastVisibleSubtitleText = '';
        this.lastRenderedSubtitleText = '';
        this.currentInspector = undefined;
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
        this.currentInspector = undefined;
        this.selectedWord = undefined;
        this.hideOverlay();
    }
}

export const bindPauseTranslateSubscriber = (playbackManager: PlaybackManager) => {
    return new PauseTranslateSubscriber(playbackManager);
};
