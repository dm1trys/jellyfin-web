export type ArdItemKind =
    | 'movie'
    | 'episode'
    | 'series'
    | 'live'
    | 'collection'
    | 'item';

export interface ArdImage {
    url: string | null;
    alt: string | null;
    title: string | null;
    aspectRatio: string | null;
}

export interface ArdItem {
    id: string | null;
    kind: ArdItemKind;
    title: string | null;
    subtitle: string | null;
    description: string | null;
    durationSeconds: number | null;
    image: ArdImage | null;
    badges: string[];
    href: string | null;
    playable: boolean;
}

export interface ArdRow {
    id: string;
    title: string | null;
    type: string;
    items: ArdItem[];
}

export interface ArdHomeResponse {
    title: string | null;
    description: string | null;
    hero: ArdItem[];
    rows: ArdRow[];
}

export interface ArdSearchResponse {
    query: string;
    suggestions: unknown[];
    shows: ArdItem[];
    videos: ArdItem[];
    page: number;
    hasMore: boolean;
}

export interface ArdSubtitleSource {
    kind: string | null;
    lang: string | null;
    format: string | null;
    url: string | null;
}

export interface ArdAudioTrack {
    kind: string | null;
    lang: string | null;
}

export interface ArdPlaybackMedia {
    url: string | null;
    mimeType: string | null;
    label: string | null;
    width: number | null;
    height: number | null;
    videoCodec: string | null;
    audios: ArdAudioTrack[];
    subtitles: ArdSubtitleSource[];
}

export interface ArdPlaybackStreamGroup {
    kind: string | null;
    label: string | null;
    media: ArdPlaybackMedia[];
}

export interface ArdItemDetailResponse {
    id: string | null;
    title: string | null;
    seriesTitle: string | null;
    synopsis: string | null;
    durationSeconds: number | null;
    images: ArdImage[];
    availability: {
        availableTo: string | null;
        geoblocked: boolean;
        fsk: number | null;
    };
    playback: {
        streams: ArdPlaybackStreamGroup[];
        subtitles: ArdSubtitleSource[];
        restriction: {
            kind: string;
            maturity: string | null;
            message: string;
        } | null;
    };
    relatedRows: ArdRow[];
}

export interface ArdRecommendationsResponse {
    title: string;
    items: ArdItem[];
}

export interface ArdPlayResponse {
    id: string | null;
    title: string | null;
    hls: string | null;
    subtitles: ArdSubtitleSource[];
    streams: ArdPlaybackStreamGroup[];
    restriction: {
        kind: string;
        maturity: string | null;
        message: string;
    } | null;
}
