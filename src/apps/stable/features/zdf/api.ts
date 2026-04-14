import type { ZdfHomeResponse, ZdfItemDetailResponse, ZdfPlayResponse, ZdfSearchResponse } from './types';

const fetchZdfJson = async <T>(pathname: string): Promise<T> => {
    const response = await fetch(pathname, {
        headers: {
            accept: 'application/json'
        }
    });

    if (!response.ok) {
        throw new Error(`ZDF request failed: ${response.status}`);
    }

    return response.json() as Promise<T>;
};

export const fetchZdfItem = (href: string) => (
    fetchZdfJson<ZdfItemDetailResponse>(`/api/zdf/item?href=${encodeURIComponent(href)}`)
);

export const fetchZdfPlay = (href: string) => (
    fetchZdfJson<ZdfPlayResponse>(`/api/zdf/play?href=${encodeURIComponent(href)}`)
);

export const fetchZdfSearch = (query: string, after = '') => (
    fetchZdfJson<ZdfSearchResponse>(`/api/zdf/search?query=${encodeURIComponent(query)}${after ? `&after=${encodeURIComponent(after)}` : ''}`)
);

export const fetchZdfHome = () => (
    fetchZdfJson<ZdfHomeResponse>('/api/zdf/home')
);

export const fetchZdfPage = (href: string, tabId = '', rowId = '', after = '') => (
    fetchZdfJson<ZdfHomeResponse>(`/api/zdf/page?href=${encodeURIComponent(href)}${tabId ? `&tabId=${encodeURIComponent(tabId)}` : ''}${rowId ? `&rowId=${encodeURIComponent(rowId)}` : ''}${after ? `&after=${encodeURIComponent(after)}` : ''}`)
);
