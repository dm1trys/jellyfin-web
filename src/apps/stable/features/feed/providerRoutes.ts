import type { AsyncRoute } from 'components/router/AsyncRoute';

import { ARD_PROVIDER } from '../ard/provider';
import { ZDF_PROVIDER } from '../zdf/provider';

const stripLeadingSlash = (path: string) => path.replace(/^\//, '');

const toProviderAsyncRoutes = (
    provider: typeof ARD_PROVIDER | typeof ZDF_PROVIDER,
    pages: {
        home: string
        page: string
        search: string
        item: string
        categories?: string
    }
): AsyncRoute[] => {
    const routes: AsyncRoute[] = [
        { path: stripLeadingSlash(provider.routes.home), page: pages.home },
        { path: stripLeadingSlash(provider.routes.page), page: pages.page },
        { path: stripLeadingSlash(provider.routes.search), page: pages.search },
        { path: stripLeadingSlash(provider.routes.item), page: pages.item }
    ];

    if (provider.routes.categories && pages.categories) {
        routes.push({
            path: stripLeadingSlash(provider.routes.categories),
            page: pages.categories
        });
    }

    return routes;
};

export const PROVIDER_ASYNC_USER_ROUTES: AsyncRoute[] = [
    ...toProviderAsyncRoutes(ARD_PROVIDER, {
        home: 'ard/home',
        page: 'ard/page',
        search: 'ard/search',
        item: 'ard/item'
    }),
    ...toProviderAsyncRoutes(ZDF_PROVIDER, {
        home: 'zdf/home',
        page: 'zdf/page',
        search: 'zdf/search',
        item: 'zdf/item',
        categories: 'zdf/categories'
    })
];
