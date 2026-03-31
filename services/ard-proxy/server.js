'use strict';

const http = require('node:http');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { URL } = require('node:url');

const HOST = process.env.ARD_PROXY_HOST || '0.0.0.0';
const PORT = Number(process.env.ARD_PROXY_PORT || 5100);
const ARD_API_BASE_URL = process.env.ARD_API_BASE_URL || 'https://api.ardmediathek.de';
const DEFAULT_USER_ID = process.env.ARD_USER_ID || 'personalized';
const USER_AGENT = process.env.ARD_PROXY_USER_AGENT || 'jellyfin-ard-proxy/0.1';
const DEFAULT_IMAGE_WIDTH = Number(process.env.ARD_IMAGE_WIDTH || 640);
const IMAGE_CACHE_DIR = process.env.ARD_IMAGE_CACHE_DIR || '/cache';
const IMAGE_CACHE_MAX_AGE_SECONDS = Number(process.env.ARD_IMAGE_CACHE_MAX_AGE_SECONDS || 86400);
const HOME_CACHE_TTL_SECONDS = Number(process.env.ARD_HOME_CACHE_TTL_SECONDS || 120);
const PAGE_CACHE_TTL_SECONDS = Number(process.env.ARD_PAGE_CACHE_TTL_SECONDS || 120);
const MAX_HOME_ROWS = Number(process.env.ARD_MAX_HOME_ROWS || 8);
const MAX_ROW_ITEMS = Number(process.env.ARD_MAX_ROW_ITEMS || 12);
const ITEM_BRANDS = (process.env.ARD_ITEM_BRANDS || 'ard,daserste,br,ndr,wdr,mdr,swr,rbb,hr,sr,one,kika,arte,3sat,alpha,tagesschau,phoenix')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
const responseCache = new Map();

function sha1(value) {
    return crypto.createHash('sha1').update(value).digest('hex');
}

function getImageCachePaths(sourceUrl) {
    const key = sha1(sourceUrl);
    return {
        metaPath: path.join(IMAGE_CACHE_DIR, `${key}.json`),
        bodyPath: path.join(IMAGE_CACHE_DIR, `${key}.bin`)
    };
}

async function ensureCacheDir() {
    await fs.mkdir(IMAGE_CACHE_DIR, { recursive: true });
}

function sendJson(res, statusCode, body) {
    const payload = JSON.stringify(body);
    res.writeHead(statusCode, {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store'
    });
    res.end(payload);
}

async function fetchJson(pathname, searchParams = {}) {
    const url = pathname.startsWith('http://') || pathname.startsWith('https://')
        ? new URL(pathname)
        : new URL(pathname, ARD_API_BASE_URL);

    Object.entries(searchParams).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
            url.searchParams.set(key, String(value));
        }
    });

    const response = await fetch(url, {
        headers: {
            'accept': 'application/json',
            'user-agent': USER_AGENT
        }
    });

    if (!response.ok) {
        const text = await response.text();
        const error = new Error(`ARD API request failed: ${response.status} ${response.statusText}`);
        error.statusCode = response.status;
        error.body = text;
        throw error;
    }

    return response.json();
}

async function fetchItemPage(id) {
    let lastError = null;

    for (const brand of ITEM_BRANDS) {
        try {
            return await fetchJson(`/page-gateway/pages/${brand}/item/${id}`, {
                embedded: 'false',
                mcV6: 'true'
            });
        } catch (error) {
            lastError = error;
            if (error?.statusCode !== 404) {
                throw error;
            }
        }
    }

    throw lastError || new Error(`ARD item not found for id ${id}`);
}

function canonicalizeWidgetHref(href) {
    if (!href) {
        return null;
    }

    const url = new URL(href);
    url.searchParams.delete('userId');
    url.searchParams.delete('embedded');

    if (!url.searchParams.has('pageNumber')) {
        url.searchParams.set('pageNumber', '0');
    }

    if (!url.searchParams.has('pageSize')) {
        url.searchParams.set('pageSize', '100');
    }

    return url.toString();
}

function firstArray(value) {
    return Array.isArray(value) ? value : [];
}

function normalizeImage(images) {
    if (images && typeof images === 'object' && !Array.isArray(images) && (images.url || images.src)) {
        const rawUrl = images.url || images.src || null;
        const normalizedUrl = typeof rawUrl === 'string'
            ? rawUrl.replaceAll('{width}', String(DEFAULT_IMAGE_WIDTH))
            : null;

        return {
            url: normalizedUrl ? `/api/ard/image?url=${encodeURIComponent(normalizedUrl)}` : null,
            alt: images.alt || images.title || null,
            title: images.title || null,
            aspectRatio: images.aspectRatio || null
        };
    }

    const list = Array.isArray(images)
        ? images
        : images && typeof images === 'object'
            ? Object.values(images)
            : [];
    const candidate = list.find((image) => image && (image.url || image.src)) || list[0];
    const rawUrl = candidate?.url || candidate?.src || null;
    const normalizedUrl = typeof rawUrl === 'string'
        ? rawUrl.replaceAll('{width}', String(DEFAULT_IMAGE_WIDTH))
        : null;

    return candidate ? {
        url: normalizedUrl ? `/api/ard/image?url=${encodeURIComponent(normalizedUrl)}` : null,
        alt: candidate.alt || candidate.title || null,
        title: candidate.title || null,
        aspectRatio: candidate.aspectRatio || null
    } : null;
}

function isAllowedImageUrl(sourceUrl) {
    try {
        const parsed = new URL(sourceUrl);
        return parsed.protocol === 'https:' && parsed.hostname === 'api.ardmediathek.de';
    } catch (_error) {
        return false;
    }
}

async function readCachedImage(sourceUrl) {
    const { metaPath, bodyPath } = getImageCachePaths(sourceUrl);

    try {
        const meta = JSON.parse(await fs.readFile(metaPath, 'utf8'));
        const ageSeconds = Math.floor((Date.now() - Number(meta.cachedAt || 0)) / 1000);
        if (!meta.cachedAt || ageSeconds > IMAGE_CACHE_MAX_AGE_SECONDS) {
            return null;
        }

        const body = await fs.readFile(bodyPath);
        return { meta, body };
    } catch (_error) {
        return null;
    }
}

async function writeCachedImage(sourceUrl, response, body) {
    const { metaPath, bodyPath } = getImageCachePaths(sourceUrl);
    const meta = {
        cachedAt: Date.now(),
        contentType: response.headers.get('content-type') || 'application/octet-stream',
        cacheControl: response.headers.get('cache-control') || null,
        etag: response.headers.get('etag') || null,
        sourceUrl
    };

    await fs.writeFile(bodyPath, body);
    await fs.writeFile(metaPath, JSON.stringify(meta));
    return meta;
}

function sendBinary(res, statusCode, meta, body, cacheHit) {
    res.writeHead(statusCode, {
        'content-type': meta.contentType || 'application/octet-stream',
        'content-length': body.length,
        'cache-control': `public, max-age=${IMAGE_CACHE_MAX_AGE_SECONDS}`,
        'x-ard-image-cache': cacheHit ? 'hit' : 'miss'
    });
    res.end(body);
}

async function fetchAndCacheImage(sourceUrl) {
    const response = await fetch(sourceUrl, {
        headers: {
            'accept': 'image/*,*/*;q=0.8',
            'user-agent': USER_AGENT
        }
    });

    if (!response.ok) {
        const error = new Error(`ARD image request failed: ${response.status} ${response.statusText}`);
        error.statusCode = response.status;
        throw error;
    }

    const body = Buffer.from(await response.arrayBuffer());
    const meta = await writeCachedImage(sourceUrl, response, body);
    return { meta, body };
}

function normalizeBadges(teaser) {
    const badges = new Set();

    firstArray(teaser?.badges).forEach((badge) => {
        if (typeof badge === 'string' && badge.trim()) {
            badges.add(badge.trim());
        }
        if (badge && typeof badge === 'object') {
            const label = badge.label || badge.text || badge.shortText || badge.title;
            if (label) {
                badges.add(String(label));
            }
        }
    });

    if (teaser?.availableTo?.startsWith?.('LIVE') || teaser?.type === 'live') {
        badges.add('LIVE');
    }

    if (teaser?.showSubtitles === true || teaser?.subtitlesAvailable === true) {
        badges.add('UT');
    }

    if (teaser?.showAudioDescription === true || teaser?.audioDescriptionAvailable === true) {
        badges.add('AD');
    }

    return Array.from(badges);
}

function normalizeHref(teaser) {
    const targetHref = teaser?.links?.target?.href || null;
    const targetId = teaser?.links?.target?.id || teaser?.links?.target?.urlId || null;
    const targetUrl = targetHref ? new URL(targetHref, ARD_API_BASE_URL) : null;

    if (targetId && targetUrl?.pathname.includes('/page-gateway/pages/') && targetUrl.pathname.includes('/item/')) {
        return `/ard/item/${encodeURIComponent(targetId)}`;
    }

    const selfHref = teaser?.links?.self?.href || null;
    const selfUrl = selfHref ? new URL(selfHref, ARD_API_BASE_URL) : null;

    if (teaser?.id && selfUrl?.pathname.includes('/page-gateway/pages/') && selfUrl.pathname.includes('/item/')) {
        return `/ard/item/${encodeURIComponent(teaser.id)}`;
    }

    const candidate = targetHref
        || teaser?.show?.homepage?.href
        || teaser?.links?.self?.href
        || teaser?.href
        || teaser?.path
        || null;

    if (!candidate) {
        return null;
    }

    const candidateUrl = new URL(candidate, ARD_API_BASE_URL);
    if (candidateUrl.pathname.includes('/page-gateway/pages/') && candidateUrl.pathname.includes('/item/')) {
        const itemId = teaser?.links?.target?.id
            || teaser?.links?.target?.urlId
            || teaser?.id
            || candidateUrl.pathname.split('/').pop();

        if (itemId) {
            return `/ard/item/${encodeURIComponent(itemId)}`;
        }
    }

    if (candidateUrl.pathname.includes('/page-gateway/pages/')) {
        return `/ardpage?href=${encodeURIComponent(candidateUrl.toString())}`;
    }

    if (candidate.startsWith('http://') || candidate.startsWith('https://')) {
        return candidateUrl.toString();
    }

    return candidateUrl.toString();
}

function normalizeKind(teaser) {
    const value = String(
        teaser?.coreAssetType
        || teaser?.show?.groupingType
        || teaser?.type
        || teaser?.teaserType
        || teaser?.itemType
        || teaser?.tracking?.atiCustomVars?.contentType
        || ''
    ).toLowerCase();

    if (value.includes('series') || value.includes('show')) {
        return 'series';
    }

    if (value.includes('episode') || value.includes('vod') || value.includes('video')) {
        return 'episode';
    }

    if (value.includes('film') || value.includes('movie')) {
        return 'movie';
    }

    if (value.includes('live')) {
        return 'live';
    }

    if (value.includes('collection') || value.includes('editorial')) {
        return 'collection';
    }

    return 'item';
}

function extractTeasers(widget) {
    const directKeys = ['teasers', 'items', 'editorials', 'entries', 'links'];

    for (const key of directKeys) {
        const list = firstArray(widget?.[key]);
        if (list.length > 0) {
            return list;
        }
    }

    if (Array.isArray(widget)) {
        return widget;
    }

    return [];
}

async function resolveWidgetTeasers(widget) {
    const direct = extractTeasers(widget);
    if (direct.length > 0) {
        return direct;
    }

    const selfHref = widget?.links?.self?.href;
    if (!selfHref) {
        return [];
    }

    try {
        const data = await fetchJson(canonicalizeWidgetHref(selfHref));
        return extractTeasers(data);
    } catch (_error) {
        return [];
    }
}

function getCachedValue(key, ttlSeconds) {
    const cached = responseCache.get(key);
    if (!cached) {
        return null;
    }

    const ageSeconds = (Date.now() - cached.cachedAt) / 1000;
    if (ageSeconds > ttlSeconds) {
        responseCache.delete(key);
        return null;
    }

    return cached.value;
}

function setCachedValue(key, value) {
    responseCache.set(key, {
        cachedAt: Date.now(),
        value
    });
    return value;
}

async function withCachedValue(key, ttlSeconds, loader) {
    const cached = getCachedValue(key, ttlSeconds);
    if (cached) {
        return cached;
    }

    return setCachedValue(key, await loader());
}

function normalizeTeaser(teaser) {
    if (!teaser || typeof teaser !== 'object') {
        return null;
    }

    const title = teaser.longTitle || teaser.mediumTitle || teaser.shortTitle || teaser.title || teaser.name || null;
    const subtitle = teaser.publicationService?.name
        || teaser.publisher
        || teaser.partner
        || teaser.show?.title
        || teaser.label
        || null;
    const images = Array.isArray(teaser.images)
        ? teaser.images
        : teaser.images && typeof teaser.images === 'object'
            ? Object.values(teaser.images)
            : teaser.image && typeof teaser.image === 'object'
                ? [teaser.image]
                : [];

    return {
        id: teaser?.links?.target?.id
            || teaser?.links?.target?.urlId
            || teaser.id
            || teaser.contentId
            || teaser.urn
            || normalizeHref(teaser),
        kind: normalizeKind(teaser),
        title,
        subtitle,
        description: teaser.synopsis || teaser.description || teaser.longDescription || null,
        durationSeconds: teaser.durationSeconds || teaser.duration || null,
        image: normalizeImage(images),
        badges: normalizeBadges(teaser),
        href: normalizeHref(teaser),
        playable: teaser.embeddable !== false && teaser.blockedByFsk !== true
    };
}

async function normalizeRow(widget) {
    const items = (await resolveWidgetTeasers(widget))
        .slice(0, MAX_ROW_ITEMS)
        .map(normalizeTeaser)
        .filter(Boolean);

    return {
        id: widget?.id || widget?.title || `row-${Math.random().toString(36).slice(2)}`,
        title: widget?.title || widget?.label || null,
        type: widget?.type || 'row',
        items
    };
}

async function normalizeHome(data) {
    const widgets = firstArray(data?.widgets);
    const heroWidget = widgets.find((widget) => widget?.type === 'stage') || null;
    const hero = heroWidget ? (await resolveWidgetTeasers(heroWidget)).map(normalizeTeaser).filter(Boolean) : [];
    const rows = (await Promise.all(
        widgets
            .filter((widget) => widget !== heroWidget)
            .slice(0, MAX_HOME_ROWS)
            .map((widget) => normalizeRow(widget))
    ))
        .filter((row) => row.items.length > 0 || row.type === 'navigation');

    return {
        title: data?.title || null,
        description: data?.description || null,
        hero,
        rows
    };
}

function normalizeSearchSection(items) {
    return firstArray(items)
        .map(normalizeTeaser)
        .filter(Boolean);
}

function normalizeSubtitles(subtitles) {
    return firstArray(subtitles).flatMap((subtitle) =>
        firstArray(subtitle?.sources).map((source) => ({
            kind: subtitle?.kind || null,
            lang: subtitle?.languageCode || null,
            format: source?.kind || null,
            url: source?.url || null
        })).filter((source) => source.url)
    );
}

function normalizeStreams(streams) {
    return firstArray(streams).map((stream) => ({
        kind: stream?.kind || null,
        label: stream?.kindName || null,
        media: firstArray(stream?.media).map((entry) => ({
            url: entry?.url || null,
            mimeType: entry?.mimeType || null,
            label: entry?.forcedLabel || null,
            width: entry?.maxHResolutionPx || null,
            height: entry?.maxVResolutionPx || null,
            videoCodec: entry?.videoCodec || null,
            audios: firstArray(entry?.audios).map((audio) => ({
                kind: audio?.kind || null,
                lang: audio?.languageCode || null
            })),
            subtitles: normalizeSubtitles(entry?.subtitles)
        })).filter((entry) => entry.url)
    }));
}

async function normalizeItem(data) {
    const widgets = firstArray(data?.widgets);
    const player = widgets.find((widget) => widget?.type === 'player_ondemand') || {};
    const embedded = player?.mediaCollection?.embedded || {};
    const meta = embedded?.meta || {};
    const maturity = player?.maturityContentRating || data?.maturityContentRating || null;
    const isFskBlocked = player?.blockedByFsk === true || (embedded?.isBlocked === true && !embedded?.streams?.length);
    const recommendations = (await Promise.all(
        widgets
            .filter((widget) => widget?.type !== 'player_ondemand')
            .map((widget) => normalizeRow(widget))
    ))
        .filter((row) => row.items.length > 0);

    return {
        id: data?.id || player?.id || null,
        title: meta?.title || player?.title || data?.title || null,
        seriesTitle: meta?.seriesTitle || player?.show?.title || null,
        synopsis: meta?.synopsis || player?.synopsis || null,
        durationSeconds: meta?.durationSeconds || null,
        images: firstArray(meta?.images).map(normalizeImage).filter(Boolean),
        availability: {
            availableTo: meta?.availableToDateTime || player?.availableTo || null,
            geoblocked: embedded?.isGeoBlocked === true || player?.geoblocked === true,
            fsk: meta?.maturityContentRating?.age || data?.fskRating?.age || null
        },
        playback: {
            streams: normalizeStreams(embedded?.streams),
            subtitles: normalizeSubtitles(embedded?.subtitles),
            restriction: isFskBlocked ? {
                kind: 'fsk',
                maturity: maturity,
                message: 'Playback is blocked by ARD age restriction. Open the video on ARD after the allowed time or verify age in an ARD account.'
            } : null
        },
        relatedRows: recommendations
    };
}

function normalizeRecommendations(data) {
    return {
        title: data?.title || 'Empfehlungen',
        items: extractTeasers(data).map(normalizeTeaser).filter(Boolean)
    };
}

function firstPlayableStream(item) {
    for (const streamGroup of item.playback.streams) {
        for (const media of streamGroup.media) {
            if (media.mimeType === 'application/vnd.apple.mpegurl') {
                return media.url;
            }
        }
    }

    for (const streamGroup of item.playback.streams) {
        for (const media of streamGroup.media) {
            if (typeof media.mimeType === 'string' && media.mimeType.startsWith('video/')) {
                return media.url;
            }
        }
    }

    return null;
}

async function handleRequest(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;

    try {
        if (pathname === '/health') {
            return sendJson(res, 200, { status: 'ok' });
        }

        if (pathname === '/api/ard/home') {
            const userId = url.searchParams.get('userId') || DEFAULT_USER_ID;
            const result = await withCachedValue(`home:${userId}`, HOME_CACHE_TTL_SECONDS, async () => {
                const data = await fetchJson('/page-gateway/pages/ard/home', {
                    userId,
                    embedded: 'false'
                });
                return normalizeHome(data);
            });
            return sendJson(res, 200, result);
        }

        if (pathname === '/api/ard/image') {
            const sourceUrl = url.searchParams.get('url') || '';
            if (!sourceUrl) {
                return sendJson(res, 400, { error: 'url is required' });
            }
            if (!isAllowedImageUrl(sourceUrl)) {
                return sendJson(res, 400, { error: 'url is not allowed' });
            }

            const cached = await readCachedImage(sourceUrl);
            if (cached) {
                return sendBinary(res, 200, cached.meta, cached.body, true);
            }

            const fresh = await fetchAndCacheImage(sourceUrl);
            return sendBinary(res, 200, fresh.meta, fresh.body, false);
        }

        if (pathname === '/api/ard/search') {
            const query = url.searchParams.get('q') || '';
            const page = Number(url.searchParams.get('page') || 0);
            const pageSize = Number(url.searchParams.get('pageSize') || 24);

            if (!query.trim()) {
                return sendJson(res, 400, { error: 'q is required' });
            }

            const [shows, vods, suggestions] = await Promise.all([
                fetchJson('/search-system/search/shows/ard', {
                    query,
                    pageSize: 48,
                    platform: 'MEDIA_THEK'
                }),
                fetchJson('/search-system/search/vods/ard', {
                    query,
                    pageNumber: page,
                    pageSize,
                    platform: 'MEDIA_THEK',
                    sortingCriteria: 'SCORE_DESC'
                }),
                fetchJson('/search-system/search/suggestions', {
                    query,
                    resultCount: 20,
                    platform: 'MEDIA_THEK'
                })
            ]);

            return sendJson(res, 200, {
                query,
                suggestions: firstArray(suggestions?.suggestions || suggestions?.items || suggestions),
                shows: normalizeSearchSection(shows?.teasers || shows?.items || shows?.shows),
                videos: normalizeSearchSection(vods?.teasers || vods?.items || vods?.vods),
                page,
                hasMore: firstArray(vods?.teasers || vods?.items || vods?.vods).length >= pageSize
            });
        }

        if (pathname === '/api/ard/page') {
            const href = url.searchParams.get('href') || '';
            if (!href) {
                return sendJson(res, 400, { error: 'href is required' });
            }

            const result = await withCachedValue(`page:${href}`, PAGE_CACHE_TTL_SECONDS, async () => {
                const data = await fetchJson(href);
                return normalizeHome(data);
            });
            return sendJson(res, 200, result);
        }

        if (pathname.startsWith('/api/ard/item/')) {
            const id = pathname.slice('/api/ard/item/'.length);
            if (!id) {
                return sendJson(res, 400, { error: 'id is required' });
            }

            const data = await fetchItemPage(id);

            return sendJson(res, 200, await normalizeItem(data));
        }

        if (pathname.startsWith('/api/ard/recommendations/')) {
            const id = pathname.slice('/api/ard/recommendations/'.length);
            if (!id) {
                return sendJson(res, 400, { error: 'id is required' });
            }

            const data = await fetchJson('/page-gateway/compilations/ard/recommendations', {
                contextItemId: id
            });

            return sendJson(res, 200, normalizeRecommendations(data));
        }

        if (pathname.startsWith('/api/ard/play/')) {
            const id = pathname.slice('/api/ard/play/'.length);
            if (!id) {
                return sendJson(res, 400, { error: 'id is required' });
            }

            const data = await fetchItemPage(id);
            const item = await normalizeItem(data);

            return sendJson(res, 200, {
                id: item.id,
                title: item.title,
                hls: firstPlayableStream(item),
                subtitles: item.playback.subtitles,
                streams: item.playback.streams,
                restriction: item.playback.restriction
            });
        }

        return sendJson(res, 404, { error: 'Not found' });
    } catch (error) {
        return sendJson(res, error.statusCode || 500, {
            error: error.message,
            upstreamStatus: error.statusCode || null
        });
    }
}

const server = http.createServer((req, res) => {
    if (!req.url) {
        return sendJson(res, 400, { error: 'Missing URL' });
    }

    return void handleRequest(req, res);
});

ensureCacheDir()
    .then(() => {
        server.listen(PORT, HOST, () => {
            console.log(`ard-proxy listening on http://${HOST}:${PORT}`);
        });
    })
    .catch((error) => {
        console.error('Failed to initialize ard-proxy cache directory', error);
        process.exit(1);
    });
