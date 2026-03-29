import type { PlaybackManager } from 'components/playback/playbackmanager';
import type { PlayerPlugin } from 'types/plugin';
import { currentSettings } from 'scripts/settings/userSettings';

import { PlaybackSubscriber } from '../utils/playbackSubscriber';
import { PauseTranslateOverlay } from './overlay';
import { fetchWordInspectorEntry, translateSubtitleText } from './providers';
import { normalizeSubtitleText, tokenizeWords } from './text';
import type { WordInspectorEntry } from './types';

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
    private translationCache = new Map<string, string>();
    private wordEntryCache = new Map<string, WordInspectorEntry>();
    private lastVisibleSubtitleText = '';
    private lastRenderedSubtitleText = '';
    private activeRequestId = 0;
    private selectedWord?: string;

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

        this.overlay.renderInspectorLoading(this.selectedWord);
        void this.loadWordInspectorEntry(this.selectedWord);
    }

    private async loadWordInspectorEntry(word: string) {
        const sourceLanguage = getSourceLanguage();
        const targetLanguage = getTargetLanguage();
        const cacheKey = `${sourceLanguage}|${targetLanguage}|${word.toLowerCase()}`;

        if (this.wordEntryCache.has(cacheKey)) {
            this.overlay.renderInspectorEntry(this.wordEntryCache.get(cacheKey) as WordInspectorEntry);
            return;
        }

        try {
            const entry = await fetchWordInspectorEntry(word, sourceLanguage, targetLanguage);
            this.wordEntryCache.set(cacheKey, entry);

            if (this.selectedWord?.toLowerCase() === word.toLowerCase()) {
                this.overlay.renderInspectorEntry(entry);
            }
        } catch (error) {
            console.error('[PauseTranslateSubscriber] word inspector error', error);
        }
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

        this.lastRenderedSubtitleText = subtitleText;
        const requestId = ++this.activeRequestId;
        this.overlay.show(subtitleText, 'Translating...', 'loading');

        const words: string[] = tokenizeWords(subtitleText);
        if (!this.selectedWord || !words.includes(this.selectedWord)) {
            this.selectedWord = words[0];
            this.overlay.setSelectedWord(this.selectedWord);
        }
        this.renderWordInspector();

        try {
            const translated = await translateSubtitleText(
                subtitleText,
                getSourceLanguage(),
                getTargetLanguage(),
                this.translationCache
            );
            if (requestId !== this.activeRequestId) {
                return;
            }

            this.overlay.show(subtitleText, translated, 'ready');
            this.overlay.setSelectedWord(this.selectedWord);
        } catch (error) {
            console.error('[PauseTranslateSubscriber] translation error', error);
            if (requestId !== this.activeRequestId) {
                return;
            }

            this.overlay.show(subtitleText, 'Could not translate this subtitle right now.', 'error');
            this.overlay.setSelectedWord(this.selectedWord);
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

export const bindPauseTranslateSubscriber = (playbackManager: PlaybackManager) => {
    const subscriber = new PauseTranslateSubscriber(playbackManager);
    const eventTarget = playbackManager as PlaybackManager & {
        addEventListener: (eventName: string, listener: EventListener) => void
    };

    eventTarget.addEventListener('playerchange', subscriber.onPlayerChange.bind(subscriber));
    eventTarget.addEventListener('pause', subscriber.onPlayerPause.bind(subscriber));
    eventTarget.addEventListener('playbackstop', subscriber.onPlayerPlaybackStop.bind(subscriber));
    eventTarget.addEventListener('stopped', subscriber.onPlayerStopped.bind(subscriber));
    eventTarget.addEventListener('timeupdate', subscriber.onPlayerTimeUpdate.bind(subscriber));
    eventTarget.addEventListener('unpause', subscriber.onPlayerUnpause.bind(subscriber));
};
