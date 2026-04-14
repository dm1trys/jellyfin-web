import type { RouteObject } from 'react-router-dom';

import { AppType } from 'constants/appType';

export interface AsyncRoute {
    /** The URL path for this route. */
    path: string
    /**
     * The relative path to the page component in the routes directory.
     * Will fallback to using the `path` value if not specified.
     */
    page?: string
    /** The app that this page is part of. */
    type?: AppType
}

const CHUNK_RELOAD_KEY = 'jellyfin:chunk-reload';

const isChunkLoadError = (error: unknown) => {
    if (!(error instanceof Error)) {
        return false;
    }

    return error.name === 'ChunkLoadError'
        || /ChunkLoadError|Loading chunk [\d]+ failed|Failed to fetch dynamically imported module/i.test(error.message);
};

export async function importWithChunkRecovery<T>(loader: () => Promise<T>): Promise<T> {
    try {
        const result = await loader();
        window.sessionStorage.removeItem(CHUNK_RELOAD_KEY);
        return result;
    } catch (error) {
        if (!isChunkLoadError(error)) {
            throw error;
        }

        const didReload = window.sessionStorage.getItem(CHUNK_RELOAD_KEY) === '1';
        if (!didReload) {
            window.sessionStorage.setItem(CHUNK_RELOAD_KEY, '1');
            window.location.reload();
        }

        throw error;
    }
}

const importRoute = (page: string, type: AppType) => {
    switch (type) {
        case AppType.Dashboard:
            return importWithChunkRecovery(() => import(/* webpackChunkName: "[request]" */ `../../apps/dashboard/routes/${page}`));
        case AppType.Experimental:
            return importWithChunkRecovery(() => import(/* webpackChunkName: "[request]" */ `../../apps/experimental/routes/${page}`));
        case AppType.Stable:
            return importWithChunkRecovery(() => import(/* webpackChunkName: "[request]" */ `../../apps/stable/routes/${page}`));
    }
};

export const toAsyncPageRoute = ({
    path,
    page,
    type = AppType.Stable
}: AsyncRoute): RouteObject => {
    return {
        path,
        lazy: async () => {
            const {
                // If there is a default export, use it as the Component for compatibility
                default: Component,
                ...route
            } = await importRoute(page ?? path, type);

            return {
                Component,
                ...route
            };
        }
    };
};
