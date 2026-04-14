import { playbackManager } from 'components/playback/playbackmanager';
import { ServerConnections } from 'lib/jellyfin-apiclient';

type SubtitleLike = {
    format?: string | null
    lang?: string | null
    url?: string | null
};

type LocalSubtitleTrack = {
    Index: number
    IsDefault: boolean
    Language: string
    Codec: string
    Path: string
};

type PlayLocalHlsItemOptions = {
    itemId: string
    title: string
    hls: string
    runtimeTicks?: number
    subtitles: LocalSubtitleTrack[]
};

export const toSubtitleFormat = (subtitle: SubtitleLike) => {
    const format = (subtitle.format || '').toLowerCase();

    if (format.includes('vtt')) {
        return 'vtt';
    }

    if (format.includes('ttml') || format.includes('ebutt')) {
        return 'ttml';
    }

    return format || 'vtt';
};

export const normalizeSubtitleLanguage = (lang?: string | null) => {
    if (!lang) {
        return 'de';
    }

    if (lang === 'deu') {
        return 'de';
    }

    return lang;
};

export const buildLocalSubtitleTracks = <T extends SubtitleLike>(
    subtitles: T[],
    toLocalSubtitleTrackPath: (subtitle: T) => string
): LocalSubtitleTrack[] => (
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

export const playLocalHlsItem = async ({
    itemId,
    title,
    hls,
    runtimeTicks,
    subtitles
}: PlayLocalHlsItemOptions) => {
    const serverId = ServerConnections.currentApiClient()?.serverId() || undefined;

    await playbackManager.play({
        items: [{
            Id: itemId,
            ServerId: serverId,
            Name: title,
            Type: 'Video',
            MediaType: 'Video',
            Url: hls,
            RunTimeTicks: runtimeTicks,
            TextTracks: subtitles,
            MediaSources: [{
                Id: `${itemId}-source`,
                Path: hls,
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
                    ...subtitles.map((track) => ({
                        Index: track.Index,
                        Type: 'Subtitle',
                        Codec: track.Codec,
                        Language: track.Language,
                        DeliveryMethod: 'External',
                        IsExternal: true,
                        Path: track.Path
                    }))
                ],
                DefaultSubtitleStreamIndex: subtitles.length ? subtitles[0].Index : -1
            }]
        }]
    });
};
