import toast from 'components/toast/toast';
import { buildLocalSubtitleTracks, playLocalHlsItem } from 'apps/stable/features/feed/playback';

import { ARD_PROVIDER } from './provider';
import type { ArdItemDetailResponse, ArdPlayResponse, ArdSubtitleSource } from './types';

const toLocalSubtitleTrackPath = (subtitle: ArdSubtitleSource) => (
    `/api/ard/subtitles?url=${encodeURIComponent(subtitle.url || '')}`
);

export const playArdItem = async (detail: ArdItemDetailResponse, playback: ArdPlayResponse) => {
    if (!playback.hls) {
        toast(playback.restriction?.message || 'No playable ARD stream found.');
        return;
    }

    const subtitleTracks = buildLocalSubtitleTracks(playback.subtitles || [], toLocalSubtitleTrackPath);
    const itemId = `local-ard-${detail.id || Date.now()}`;

    await playLocalHlsItem({
        itemId,
        title: detail.title || ARD_PROVIDER.defaults.playbackTitle,
        hls: playback.hls,
        runtimeTicks: detail.durationSeconds ? detail.durationSeconds * 10000000 : undefined,
        subtitles: subtitleTracks
    });
};
