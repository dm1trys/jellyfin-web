import type { DependencyList } from 'react';

import type { FeedPage } from './types';
import { useAsyncData } from './useAsyncData';

type UseAsyncFeedPageOptions = {
    enabled?: boolean;
    resetOnDisable?: boolean;
    disableError?: string | null;
};

export function useAsyncFeedPage(
    loadPage: () => Promise<FeedPage>,
    deps: DependencyList,
    options: UseAsyncFeedPageOptions = {}
) {
    return useAsyncData(loadPage, deps, {
        ...options,
        errorMessage: 'Failed to load page'
    });
}
