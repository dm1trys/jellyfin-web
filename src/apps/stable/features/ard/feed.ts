import type { FeedCard, FeedItemDetail, FeedPage, FeedShelfBlock, FeedSubtitleTrack } from 'apps/stable/features/feed/types';

import { ARD_PROVIDER } from './provider';
import type { ArdHomeResponse, ArdItem, ArdItemDetailResponse, ArdRow, ArdSearchResponse, ArdSubtitleSource } from './types';

export const normalizeArdHref = (href: string | null) => {
    if (!href) {
        return '#';
    }

    return href
        .replace(/^\/ard\/item\//, '/arditem/')
        .replace(/^\/ardpage\?href=/, '/ardpage?href=')
        .replace(/^https?:\/\/api\.ardmediathek\.de\/page-gateway\/pages\/[^/]+\/item\/([^/?#]+).*$/i, '/arditem/$1');
};

const mapArdItemToFeedCard = (item: ArdItem | null): FeedCard | null => {
    if (!item) {
        return null;
    }

    return {
        id: item.id || item.href || item.title || 'ard-item',
        provider: 'ard',
        kind: item.playable || item.kind === 'movie' || item.kind === 'episode' || item.kind === 'item' || item.kind === 'live'
            ? 'item'
            : item.kind === 'collection'
                ? 'collection'
                : 'page',
        title: item.title,
        subtitle: item.subtitle,
        description: item.description,
        image: item.image,
        badges: item.badges,
        href: item.href,
        playableHref: item.playable ? item.href : null
    };
};

const mapArdRowToFeedShelf = (row: ArdRow): FeedShelfBlock => ({
    type: 'shelf',
    id: row.id,
    title: row.title,
    items: row.items.map(mapArdItemToFeedCard).filter(Boolean) as FeedCard[],
    paging: null
});

export const mapArdHomeResponseToFeedPage = (response: ArdHomeResponse): FeedPage => ({
    provider: 'ard',
    title: response.title,
    description: response.description,
    hero: mapArdItemToFeedCard(response.hero?.[0] || null),
    tabs: [],
    shelves: response.rows.map(mapArdRowToFeedShelf)
});

export const mapArdSearchResponseToFeedPage = (response: ArdSearchResponse): FeedPage => ({
    provider: 'ard',
    title: response.query ? `Search: ${response.query}` : 'ARD Search',
    description: null,
    hero: null,
    tabs: [],
    shelves: [
        {
            type: 'shelf',
            id: `ard-search-shows-${response.query || 'results'}`,
            title: 'Shows',
            items: response.shows.map(mapArdItemToFeedCard).filter(Boolean) as FeedCard[],
            paging: null
        },
        {
            type: 'shelf',
            id: `ard-search-videos-${response.query || 'results'}`,
            title: 'Videos',
            items: response.videos.map(mapArdItemToFeedCard).filter(Boolean) as FeedCard[],
            paging: null
        }
    ]
});

export const mapArdRowsToFeedShelves = (rows: ArdRow[]): FeedShelfBlock[] => (
    rows.map(mapArdRowToFeedShelf)
);

export const resolveArdFeedCardHref = (item: FeedCard) => normalizeArdHref(item.playableHref || item.href);

const mapArdSubtitleTrack = (subtitle: ArdSubtitleSource): FeedSubtitleTrack => ({
    kind: subtitle.kind,
    lang: subtitle.lang,
    format: subtitle.format,
    url: subtitle.url
});

const dedupeSubtitles = (subtitles: FeedSubtitleTrack[]) => (
    subtitles.filter((subtitle, index, list) => (
        Boolean(subtitle.url) && list.findIndex((entry) => entry.url === subtitle.url) === index
    ))
);

export const mapArdItemDetailToFeedItemDetail = (detail: ArdItemDetailResponse): FeedItemDetail => ({
    provider: ARD_PROVIDER.label,
    title: detail.title,
    subtitle: detail.seriesTitle,
    description: detail.synopsis,
    image: detail.images[0] || null,
    meta: [
        typeof detail.durationSeconds === 'number' ? `${Math.round(detail.durationSeconds / 60)} min` : null,
        detail.availability.fsk ? `FSK ${detail.availability.fsk}` : null,
        detail.availability.availableTo ? `Available until ${new Date(detail.availability.availableTo).toLocaleDateString()}` : null
    ].filter(Boolean) as string[],
    subtitles: dedupeSubtitles([
        ...(detail.playback.subtitles || []).map(mapArdSubtitleTrack),
        ...((detail.playback.streams || []).flatMap((group) => (
            Array.isArray(group?.media)
                ? group.media.flatMap((media) => Array.isArray(media?.subtitles) ? media.subtitles.map(mapArdSubtitleTrack) : [])
                : []
        )))
    ]),
    restriction: detail.playback.restriction ? {
        kind: detail.playback.restriction.kind,
        maturity: detail.playback.restriction.maturity,
        message: detail.playback.restriction.message
    } : null,
    notes: []
});
