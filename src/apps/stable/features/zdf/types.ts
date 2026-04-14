export interface ZdfImage {
    url: string | null;
    alt: string | null;
    title: string | null;
    aspectRatio: string | null;
}

export interface ZdfSubtitleSource {
    kind: string | null;
    lang: string | null;
    format: string | null;
    url: string | null;
}

export interface ZdfAudioTrack {
    kind: string | null;
    lang: string | null;
}

export interface ZdfPlaybackMedia {
    url: string | null;
    mimeType: string | null;
    label: string | null;
    width: number | null;
    height: number | null;
    videoCodec: string | null;
    audios: ZdfAudioTrack[];
    subtitles: ZdfSubtitleSource[];
}

export interface ZdfPlaybackStreamGroup {
    kind: string | null;
    label: string | null;
    media: ZdfPlaybackMedia[];
}

export interface ZdfBrowseItem {
    id: string | null;
    kind: 'video' | 'item' | 'page';
    title: string | null;
    subtitle: string | null;
    description: string | null;
    image: ZdfImage | null;
    badges: string[];
    href: string | null;
}

export interface ZdfSearchResponse {
    query: string;
    videos: ZdfBrowseItem[];
    hasMore: boolean;
    nextCursor: string | null;
}

export interface ZdfHomeRow {
    id: string;
    title: string | null;
    items: ZdfBrowseItem[];
    nextCursor?: string | null;
    hasMore?: boolean;
}

export interface ZdfBrowseTab {
    id: string;
    title: string | null;
}

export interface ZdfHomeResponse {
    title: string | null;
    description: string | null;
    hero: ZdfBrowseItem | null;
    rows: ZdfHomeRow[];
    tabs: ZdfBrowseTab[];
}

export interface ZdfItemDetailResponse {
    id: string | null;
    href: string | null;
    title: string | null;
    seriesTitle: string | null;
    synopsis: string | null;
    durationMs: number | null;
    images: ZdfImage[];
    availability: {
        availableTo: string | null;
        geoblocked: boolean;
        fsk: string | null;
        fskBlocked: boolean;
    };
    episodeInfo: {
        episodeNumber: number | null;
        seasonNumber: number | null;
    };
    playback: {
        hls: string | null;
        subtitles: ZdfSubtitleSource[];
        streams: ZdfPlaybackStreamGroup[];
        restriction: {
            kind: string;
            maturity: string | null;
            message: string;
        } | null;
    };
    variants: {
        default: {
            vodMediaType: string | null;
            ptmdTemplate: string | null;
        } | null;
        dgs: {
            vodMediaType: string | null;
            ptmdTemplate: string | null;
        } | null;
    };
}

export interface ZdfPlayResponse {
    id: string | null;
    title: string | null;
    hls: string | null;
    subtitles: ZdfSubtitleSource[];
    streams: ZdfPlaybackStreamGroup[];
    restriction: {
        kind: string;
        maturity: string | null;
        message: string;
    } | null;
}
