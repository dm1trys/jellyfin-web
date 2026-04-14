import type { ProviderUiConfig } from 'apps/stable/features/feed/providerTypes';

export const ZDF_PROVIDER: ProviderUiConfig = {
    id: 'zdf',
    label: 'ZDF',
    searchPlaceholder: 'ZDF durchsuchen',
    navLinks: [
        { to: '/zdfhome', label: 'ZDF' },
        { to: '/zdfcategories', label: 'Kategorien' },
        { to: '/zdfsearch', label: 'Suche' }
    ],
    routes: {
        home: '/zdfhome',
        search: '/zdfsearch',
        page: '/zdfpage',
        item: '/zdfitem/*',
        categories: '/zdfcategories'
    },
    defaults: {
        shelfTitle: 'ZDF',
        playbackTitle: 'ZDF'
    }
};
