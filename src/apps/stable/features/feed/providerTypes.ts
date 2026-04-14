export type ProviderNavLink = {
    to: string
    label: string
};

export type ProviderUiConfig = {
    id: string
    label: string
    searchPlaceholder: string
    navLinks: ProviderNavLink[]
    routes: {
        home: string
        search: string
        page: string
        item: string
        categories?: string
    }
    defaults: {
        shelfTitle: string
        playbackTitle: string
    }
};
