import toast from 'components/toast/toast';
import { playbackManager } from 'components/playback/playbackmanager';
import { ServerConnections } from 'lib/jellyfin-apiclient';

import type { ArdItemDetailResponse, ArdPlayResponse, ArdSubtitleSource } from './types';

const toSubtitleFormat = (subtitle: ArdSubtitleSource) => {
    const format = (subtitle.format || '').toLowerCase();

    if (format.includes('vtt')) {
        return 'vtt';
    }

    if (format.includes('ttml') || format.includes('ebutt')) {
        return 'ttml';
    }

    return format || 'vtt';
};

const normalizeSubtitleLanguage = (lang?: string | null) => {
    if (!lang) {
        return 'de';
    }

    if (lang === 'deu') {
        return 'de';
    }

    return lang;
};

const toLocalSubtitleTrackPath = (subtitle: ArdSubtitleSource) => (
    `/api/ard/subtitles?url=${encodeURIComponent(subtitle.url || '')}`
);

const buildSubtitleTracks = (subtitles: ArdSubtitleSource[]) => (
    subtitles
        .filter((subtitle) => subtitle.url && toSubtitleFormat(subtitle) === 'vtt')
        .map((subtitle, index) => ({
            Index: index + 1,
            IsDefault: index === 0,
            Language: normalizeSubtitleLanguage(subtitle.lang),
            Codec: toSubtitleFormat(subtitle),
            Path: toLocalSubtitleTrackPath(subtitle)
        }))
);

export const playArdItem = async (detail: ArdItemDetailResponse, playback: ArdPlayResponse) => {
    if (!playback.hls) {
        toast(playback.restriction?.message || 'No playable ARD stream found.');
        return;
    }

    const subtitleTracks = buildSubtitleTracks(playback.subtitles || []);
    const itemId = `local-ard-${detail.id || Date.now()}`;
    const serverId = ServerConnections.currentApiClient()?.serverId() || undefined;

    await playbackManager.play({
        items: [{
            Id: itemId,
            ServerId: serverId,
            Name: detail.title || 'ARD',
            Type: 'Video',
            MediaType: 'Video',
            Url: playback.hls,
            RunTimeTicks: detail.durationSeconds ? detail.durationSeconds * 10000000 : undefined,
            TextTracks: subtitleTracks,
            MediaSources: [{
                Id: `${itemId}-source`,
                Path: playback.hls,
                Container: 'hls',
                Protocol: 'Http',
                SupportsDirectPlay: true,
                SupportsDirectStream: false,
                RequiredHttpHeaders: [],
                MediaStreams: [
                    {
                        Index: 0,
                        Type: 'Video'
                    },
                    ...subtitleTracks.map((track) => ({
                        Index: track.Index,
                        Type: 'Subtitle',
                        Codec: track.Codec,
                        Language: track.Language,
                        DeliveryMethod: 'External',
                        IsExternal: true,
                        Path: track.Path
                    }))
                ],
                DefaultSubtitleStreamIndex: subtitleTracks.length ? subtitleTracks[0].Index : -1
            }]
        }]
    });
};
