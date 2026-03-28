import type { PlaybackManager } from 'components/playback/playbackmanager';
import type { PlayerPlugin } from 'types/plugin';

import { PlaybackSubscriber } from './playbackSubscriber';

const TRANSLATION_CONFIG = {
    sourceLanguage: 'en',
    targetLanguage: 'uk',
    provider: 'mymemory'
} as const;

const OVERLAY_CLASS = 'pauseTranslateOverlay';

const normalizeSubtitleText = (text: string) => text
    .replace(/<[^>]+>/g, ' ')
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n')
    .trim();

class PauseTranslateSubscriber extends PlaybackSubscriber {
    private overlay?: HTMLDivElement;
    private originalNode?: HTMLDivElement;
    private translatedNode?: HTMLDivElement;
    private translationCache = new Map<string, string>();
    private lastVisibleSubtitleText = '';
    private lastRenderedSubtitleText = '';
    private activeRequestId = 0;

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

        this.overlay.append(this.originalNode, this.translatedNode);
        document.body.appendChild(this.overlay);
    }

    private showOverlay(original: string, translated: string, tone: 'ready' | 'loading' | 'error' = 'ready') {
        this.ensureOverlay();
        if (!this.overlay || !this.originalNode || !this.translatedNode) {
            return;
        }

        this.originalNode.textContent = original;
        this.translatedNode.textContent = translated;
        this.overlay.dataset.tone = tone;
        this.overlay.classList.remove('hide');
    }

    private hideOverlay() {
        if (this.overlay) {
            this.overlay.classList.add('hide');
        }
    }

    private getVisibleSubtitleText(player?: PlayerPlugin) {
        const subtitleText = player?.getVisibleSubtitleText?.() || '';
        return normalizeSubtitleText(subtitleText);
    }

    private async translateSubtitleText(text: string) {
        if (this.translationCache.has(text)) {
            return this.translationCache.get(text) as string;
        }

        if (TRANSLATION_CONFIG.provider !== 'mymemory') {
            throw new Error(`Unsupported provider: ${TRANSLATION_CONFIG.provider}`);
        }

        const url = new URL('https://api.mymemory.translated.net/get');
        url.searchParams.set('q', text);
        url.searchParams.set(
            'langpair',
            `${TRANSLATION_CONFIG.sourceLanguage}|${TRANSLATION_CONFIG.targetLanguage}`
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
        this.hideOverlay();
    }

    onPlayerPause() {
        this.syncVisibleSubtitleText();
        void this.renderPauseOverlay();
    }

    onPlayerPlaybackStop() {
        this.lastVisibleSubtitleText = '';
        this.lastRenderedSubtitleText = '';
        this.hideOverlay();
    }

    onPlayerStopped() {
        this.lastVisibleSubtitleText = '';
        this.lastRenderedSubtitleText = '';
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
        this.hideOverlay();
    }
}

export const bindPauseTranslateSubscriber = (playbackManager: PlaybackManager) => new PauseTranslateSubscriber(playbackManager);
