import type { ProviderUiConfig } from 'apps/stable/features/feed/providerTypes';

export const ARD_PROVIDER: ProviderUiConfig = {
    id: 'ard',
    label: 'ARD',
    searchPlaceholder: 'ARD Mediathek durchsuchen',
    navLinks: [
        { to: '/ardhome', label: 'ARD' },
        { to: '/ardsearch', label: 'Suche' }
    ],
    routes: {
        home: '/ardhome',
        search: '/ardsearch',
        page: '/ardpage',
        item: '/arditem/:id'
    },
    defaults: {
        shelfTitle: 'ARD',
        playbackTitle: 'ARD'
    }
};
