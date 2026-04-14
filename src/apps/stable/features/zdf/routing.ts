const isLikelyZdfItemPath = (pathname: string) => (
    pathname.includes('/video/')
    || /-(movie|episode|folge|sendung|clip|livestream)-\d+$/i.test(pathname)
);

export const normalizeZdfHref = (href: string | null, kind: 'video' | 'item' | 'page' | null = null) => {
    if (!href) {
        return '#';
    }

    try {
        const url = new URL(href, 'https://www.zdf.de');
        if (/(\.|^)zdf\.de$/i.test(url.hostname)) {
            const isItem = kind === 'video' || kind === 'item' || isLikelyZdfItemPath(url.pathname);

            return isItem
                ? `/zdfitem${url.pathname}`
                : `/zdfpage?href=${encodeURIComponent(url.toString())}`;
        }

        return `/zdfitem?href=${encodeURIComponent(url.toString())}`;
    } catch (_error) {
        return `/zdfpage?href=${encodeURIComponent(href)}`;
    }
};

export const resolveZdfHref = (routePath: string, search: string) => {
    const params = new URLSearchParams(search);
    const href = params.get('href');
    if (href) {
        return href;
    }

    const normalizedPath = routePath.replace(/^\/+/, '');
    if (!normalizedPath) {
        return '';
    }

    if (/^https?:\/\//i.test(normalizedPath)) {
        return normalizedPath;
    }

    return `https://www.zdf.de/${normalizedPath}`;
};
