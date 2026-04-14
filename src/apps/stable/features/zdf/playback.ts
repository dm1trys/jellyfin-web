import toast from 'components/toast/toast';
import { buildLocalSubtitleTracks, playLocalHlsItem } from 'apps/stable/features/feed/playback';

import { ZDF_PROVIDER } from './provider';
import type { ZdfItemDetailResponse, ZdfPlayResponse, ZdfSubtitleSource } from './types';

const toLocalSubtitleTrackPath = (subtitle: ZdfSubtitleSource) => (
    `/api/zdf/subtitles?url=${encodeURIComponent(subtitle.url || '')}`
);

export const playZdfItem = async (detail: ZdfItemDetailResponse, playback: ZdfPlayResponse) => {
    if (!playback.hls) {
        toast(playback.restriction?.message || 'No playable ZDF stream found.');
        return;
    }

    const subtitleTracks = buildLocalSubtitleTracks(playback.subtitles || [], toLocalSubtitleTrackPath);
    const itemId = `local-zdf-${detail.id || Date.now()}`;

    await playLocalHlsItem({
        itemId,
        title: detail.title || ZDF_PROVIDER.defaults.playbackTitle,
        hls: playback.hls,
        runtimeTicks: detail.durationMs ? detail.durationMs * 10000 : undefined,
        subtitles: subtitleTracks
    });
};
