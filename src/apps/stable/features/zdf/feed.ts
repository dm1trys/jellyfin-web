import type { FeedCard, FeedItemDetail, FeedPage, FeedShelfBlock, FeedSubtitleTrack, FeedTabLink } from 'apps/stable/features/feed/types';

import { normalizeZdfHref } from './routing';
import { ZDF_PROVIDER } from './provider';
import type { ZdfBrowseItem, ZdfBrowseTab, ZdfHomeResponse, ZdfHomeRow, ZdfItemDetailResponse, ZdfSearchResponse, ZdfSubtitleSource } from './types';

const mapZdfItemToFeedCard = (item: ZdfBrowseItem | null): FeedCard | null => {
    if (!item) {
        return null;
    }

    return {
        id: item.id || item.href || item.title || 'zdf-item',
        provider: 'zdf',
        kind: item.kind === 'video' || item.kind === 'item' ? 'item' : 'page',
        title: item.title,
        subtitle: item.subtitle,
        description: item.description,
        image: item.image,
        badges: item.badges,
        href: item.href,
        playableHref: item.kind === 'video' || item.kind === 'item' ? item.href : null
    };
};

const mapZdfRowToFeedShelf = (row: ZdfHomeRow): FeedShelfBlock => ({
    type: 'shelf',
    id: row.id,
    title: row.title,
    items: row.items.map(mapZdfItemToFeedCard).filter(Boolean) as FeedCard[],
    paging: row.hasMore || row.nextCursor
        ? {
            hasMore: Boolean(row.hasMore),
            nextCursor: row.nextCursor || null
        }
        : null
});

const mapZdfTabs = (tabs: ZdfBrowseTab[]): FeedTabLink[] => (
    tabs.map((tab) => ({
        id: tab.id,
        title: tab.title
    }))
);

export const mapZdfHomeResponseToFeedPage = (response: ZdfHomeResponse): FeedPage => ({
    provider: 'zdf',
    title: response.title,
    description: response.description,
    hero: mapZdfItemToFeedCard(response.hero),
    tabs: mapZdfTabs(response.tabs),
    shelves: response.rows.map(mapZdfRowToFeedShelf)
});

export const mapZdfSearchResponseToFeedPage = (response: ZdfSearchResponse): FeedPage => ({
    provider: 'zdf',
    title: response.query ? `Search: ${response.query}` : 'ZDF Search',
    description: null,
    hero: null,
    tabs: [],
    shelves: [{
        type: 'shelf',
        id: `zdf-search-${response.query || 'results'}`,
        title: 'Videos',
        items: response.videos.map(mapZdfItemToFeedCard).filter(Boolean) as FeedCard[],
        paging: {
            hasMore: response.hasMore,
            nextCursor: response.nextCursor
        }
    }]
});

export const resolveZdfFeedCardHref = (item: FeedCard): string => (
    normalizeZdfHref(item.playableHref || item.href, item.kind === 'item' ? 'video' : 'page')
);

const mapZdfSubtitleTrack = (subtitle: ZdfSubtitleSource): FeedSubtitleTrack => ({
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

export const mapZdfItemDetailToFeedItemDetail = (detail: ZdfItemDetailResponse): FeedItemDetail => ({
    provider: ZDF_PROVIDER.label,
    title: detail.title,
    subtitle: detail.seriesTitle,
    description: detail.synopsis,
    image: detail.images[0] || null,
    meta: [
        typeof detail.durationMs === 'number' ? `${Math.round(detail.durationMs / 60000)} min` : null,
        detail.availability.fsk ? `FSK ${detail.availability.fsk}` : null,
        typeof detail.episodeInfo.seasonNumber === 'number' ? `Season ${detail.episodeInfo.seasonNumber}` : null,
        typeof detail.episodeInfo.episodeNumber === 'number' ? `Episode ${detail.episodeInfo.episodeNumber}` : null
    ].filter(Boolean) as string[],
    subtitles: dedupeSubtitles((detail.playback.subtitles || []).map(mapZdfSubtitleTrack)),
    restriction: detail.playback.restriction ? {
        kind: detail.playback.restriction.kind,
        maturity: detail.playback.restriction.maturity,
        message: detail.playback.restriction.message
    } : null,
    notes: [
        detail.variants.dgs ? 'DGS variant is available for this item.' : null
    ].filter(Boolean) as string[]
});
