import type {
    ArdHomeResponse,
    ArdItemDetailResponse,
    ArdPlayResponse,
    ArdRecommendationsResponse,
    ArdSearchResponse
} from './types';

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

export const fetchArdItem = (id: string) => (
    fetchArdJson<ArdItemDetailResponse>(`/api/ard/item/${encodeURIComponent(id)}`)
);

export const fetchArdRecommendations = (id: string) => (
    fetchArdJson<ArdRecommendationsResponse>(`/api/ard/recommendations/${encodeURIComponent(id)}`)
);

export const fetchArdPlay = (id: string) => (
    fetchArdJson<ArdPlayResponse>(`/api/ard/play/${encodeURIComponent(id)}`)
);
