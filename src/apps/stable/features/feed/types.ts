export interface FeedImage {
    url: string | null;
    alt: string | null;
    title: string | null;
    aspectRatio: string | null;
}

export interface FeedSubtitleTrack {
    kind: string | null;
    lang: string | null;
    format: string | null;
    url: string | null;
}

export interface FeedPlaybackRestriction {
    kind: string | null;
    maturity: string | null;
    message: string | null;
}

export interface FeedCard {
    id: string;
    provider: string;
    kind: 'item' | 'page' | 'collection';
    title: string | null;
    subtitle: string | null;
    description: string | null;
    image: FeedImage | null;
    badges: string[];
    href: string | null;
    playableHref?: string | null;
}

export interface FeedPagination {
    hasMore: boolean;
    nextCursor: string | null;
}

export interface FeedShelfBlock {
    type: 'shelf';
    id: string;
    title: string | null;
    items: FeedCard[];
    paging?: FeedPagination | null;
}

export interface FeedTabLink {
    id: string;
    title: string | null;
}

export interface FeedPage {
    provider: string;
    title: string | null;
    description: string | null;
    hero: FeedCard | null;
    tabs: FeedTabLink[];
    shelves: FeedShelfBlock[];
}

export interface FeedItemDetail {
    provider: string;
    title: string | null;
    subtitle: string | null;
    description: string | null;
    image: FeedImage | null;
    meta: string[];
    subtitles: FeedSubtitleTrack[];
    restriction: FeedPlaybackRestriction | null;
    notes: string[];
}
