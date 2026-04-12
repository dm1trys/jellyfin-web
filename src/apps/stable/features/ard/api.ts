import type {
    ArdHomeResponse,
    ArdItemDetailResponse,
    ArdPlayResponse,
    ArdRecommendationsResponse,
    ArdSearchResponse,
    ArdSessionResponse
} from './types';

const withAgeQuery = (pathname: string, ageRating?: number | null) => {
    if (typeof ageRating !== 'number' || !Number.isFinite(ageRating)) {
        return pathname;
    }

    const separator = pathname.includes('?') ? '&' : '?';
    return `${pathname}${separator}age=${encodeURIComponent(String(ageRating))}`;
};

const fetchArdJson = async <T>(pathname: string): Promise<T> => {
    const response = await fetch(pathname, {
        headers: {
            accept: 'application/json'
        }
    });

    if (!response.ok) {
        throw new Error(`ARD request failed: ${response.status}`);
    }

    return response.json() as Promise<T>;
};

export const fetchArdHome = () => fetchArdJson<ArdHomeResponse>('/api/ard/home');

export const fetchArdPage = (href: string) => (
    fetchArdJson<ArdHomeResponse>(`/api/ard/page?href=${encodeURIComponent(href)}`)
);

export const fetchArdSearch = (query: string, page = 0) => (
    fetchArdJson<ArdSearchResponse>(`/api/ard/search?q=${encodeURIComponent(query)}&page=${page}`)
);

export const fetchArdItem = (id: string, ageRating?: number | null) => (
    fetchArdJson<ArdItemDetailResponse>(withAgeQuery(`/api/ard/item/${encodeURIComponent(id)}`, ageRating))
);

export const fetchArdRecommendations = (id: string) => (
    fetchArdJson<ArdRecommendationsResponse>(`/api/ard/recommendations/${encodeURIComponent(id)}`)
);

export const fetchArdPlay = (id: string, ageRating?: number | null) => (
    fetchArdJson<ArdPlayResponse>(withAgeQuery(`/api/ard/play/${encodeURIComponent(id)}`, ageRating))
);

export const fetchArdSession = () => (
    fetchArdJson<ArdSessionResponse>('/api/ard/session')
);

export const loginArdSession = async () => {
    const response = await fetch('/api/ard/session/login', {
        method: 'POST',
        headers: {
            accept: 'application/json'
        }
    });

    if (!response.ok) {
        throw new Error(`ARD session login failed: ${response.status}`);
    }

    return response.json() as Promise<ArdSessionResponse>;
};

export const clearArdSession = async () => {
    const response = await fetch('/api/ard/session', {
        method: 'DELETE',
        headers: {
            accept: 'application/json'
        }
    });

    if (!response.ok && response.status !== 204) {
        throw new Error(`ARD session clear failed: ${response.status}`);
    }
};
