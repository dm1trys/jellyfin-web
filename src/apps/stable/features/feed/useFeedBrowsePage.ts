import { useEffect, useMemo, useState } from 'react';

import type { FeedPage, FeedShelfBlock } from './types';

type LoadFeedPage = (tabId?: string, rowId?: string, after?: string) => Promise<FeedPage>;

const getLoadedTabShelfSafe = (shelves: FeedShelfBlock[], nextTabId: string) => (
    shelves.find((shelf) => shelf.id.endsWith(`-${nextTabId}`)) || null
);

const mergeShelves = (currentShelves: FeedShelfBlock[], incomingShelves: FeedShelfBlock[]) => {
    const incomingById = new Map(incomingShelves.map((shelf) => [shelf.id, shelf]));

    const merged = currentShelves.map((shelf) => {
        const incoming = incomingById.get(shelf.id);
        if (!incoming) {
            return shelf;
        }

        return {
            ...shelf,
            ...incoming,
            items: [...shelf.items, ...incoming.items]
        };
    });

    for (const shelf of incomingShelves) {
        if (!currentShelves.some((current) => current.id === shelf.id)) {
            merged.push(shelf);
        }
    }

    return merged;
};

export function useFeedBrowsePage(href: string, routeTabId: string, loadPage: LoadFeedPage) {
    const [data, setData] = useState<FeedPage | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [activeSeasonId, setActiveSeasonId] = useState<string | null>(null);
    const [activeGroupedTabId, setActiveGroupedTabId] = useState<string | null>(null);
    const [loadingShelfIds, setLoadingShelfIds] = useState<Record<string, boolean>>({});
    const [loadingTabIds, setLoadingTabIds] = useState<string[]>([]);
    const [tabErrors, setTabErrors] = useState<Record<string, string>>({});

    const hasGroupedTabs = Boolean(data?.tabs.length && !routeTabId);
    const groupedActiveShelf = hasGroupedTabs && activeGroupedTabId
        ? getLoadedTabShelfSafe(data?.shelves || [], activeGroupedTabId)
        : null;
    const seasonRows = data?.tabs.length ? [] : (data?.shelves || []).filter((shelf) => shelf.items.length > 0);
    const visibleRows = seasonRows.length > 1 && activeSeasonId
        ? seasonRows.filter((shelf) => shelf.id === activeSeasonId)
        : hasGroupedTabs
            ? (groupedActiveShelf ? [groupedActiveShelf] : [])
            : data?.shelves || [];

    useEffect(() => {
        let cancelled = false;

        if (!href) {
            setData(null);
            setError('Missing page href');
            return () => {
                cancelled = true;
            };
        }

        loadPage(routeTabId)
            .then((result) => {
                if (!cancelled) {
                    setData(result);
                    setError(null);
                    setActiveSeasonId(null);
                    setActiveGroupedTabId(result.tabs[0]?.id || null);
                    setLoadingShelfIds({});
                    setLoadingTabIds([]);
                    setTabErrors({});
                }
            })
            .catch((fetchError) => {
                if (!cancelled) {
                    setError(fetchError instanceof Error ? fetchError.message : 'Failed to load page');
                }
            });

        return () => {
            cancelled = true;
        };
    }, [href, routeTabId, loadPage]);

    useEffect(() => {
        if (seasonRows.length > 1 && !activeSeasonId) {
            setActiveSeasonId(seasonRows[0]?.id || null);
            return;
        }

        if (activeSeasonId && !seasonRows.some((row) => row.id === activeSeasonId)) {
            setActiveSeasonId(seasonRows[0]?.id || null);
        }
    }, [activeSeasonId, seasonRows]);

    useEffect(() => {
        if (!hasGroupedTabs) {
            setActiveGroupedTabId(null);
            return;
        }

        if (!activeGroupedTabId && data?.tabs[0]?.id) {
            setActiveGroupedTabId(data.tabs[0].id);
            return;
        }

        if (activeGroupedTabId && !(data?.tabs || []).some((tab) => tab.id === activeGroupedTabId)) {
            setActiveGroupedTabId(data?.tabs[0]?.id || null);
        }
    }, [activeGroupedTabId, data?.tabs, hasGroupedTabs]);

    const getLoadedTabShelf = (nextTabId: string) => (
        getLoadedTabShelfSafe(data?.shelves || [], nextTabId)
    );

    const loadTabInternal = (nextTabId: string) => {
        if (!href || routeTabId || loadingTabIds.includes(nextTabId) || getLoadedTabShelf(nextTabId)) {
            return;
        }

        setLoadingTabIds((current) => [...current, nextTabId]);
        setTabErrors((current) => {
            const next = { ...current };
            delete next[nextTabId];
            return next;
        });

        loadPage(nextTabId)
            .then((nextPage) => {
                setData((current) => current ? {
                    ...current,
                    ...nextPage,
                    hero: current.hero,
                    description: current.description,
                    tabs: current.tabs,
                    shelves: mergeShelves(current.shelves, nextPage.shelves)
                } : nextPage);
                setError(null);
            })
            .catch((fetchError) => {
                setTabErrors((current) => ({
                    ...current,
                    [nextTabId]: fetchError instanceof Error ? fetchError.message : 'Failed to load section'
                }));
            })
            .finally(() => {
                setLoadingTabIds((current) => current.filter((id) => id !== nextTabId));
            });
    };

    useEffect(() => {
        if (!hasGroupedTabs || !activeGroupedTabId || routeTabId || getLoadedTabShelf(activeGroupedTabId) || loadingTabIds.includes(activeGroupedTabId)) {
            return;
        }

        loadTabInternal(activeGroupedTabId);
    }, [activeGroupedTabId, data?.shelves, hasGroupedTabs, loadingTabIds, routeTabId]);

    const getShelfTabId = (shelf: FeedShelfBlock) => (
        data?.tabs.find((tab) => shelf.id.endsWith(`-${tab.id}`))?.id || routeTabId || ''
    );

    const loadMoreShelf = (shelf: FeedShelfBlock) => {
        if (!shelf.paging?.nextCursor || loadingShelfIds[shelf.id]) {
            return;
        }

        setLoadingShelfIds((current) => ({
            ...current,
            [shelf.id]: true
        }));

        loadPage(getShelfTabId(shelf), shelf.id, shelf.paging.nextCursor)
            .then((nextPage) => {
                setData((current) => current ? {
                    ...current,
                    ...nextPage,
                    hero: nextPage.hero || current.hero,
                    description: nextPage.description || current.description,
                    tabs: nextPage.tabs.length ? nextPage.tabs : current.tabs,
                    shelves: mergeShelves(current.shelves, nextPage.shelves)
                } : nextPage);
                setError(null);
            })
            .catch((fetchError) => {
                setError(fetchError instanceof Error ? fetchError.message : 'Failed to load more items');
            })
            .finally(() => {
                setLoadingShelfIds((current) => {
                    const next = { ...current };
                    delete next[shelf.id];
                    return next;
                });
            });
    };

    const activateGroupedTab = (nextTabId: string) => {
        setActiveGroupedTabId(nextTabId);
        loadTabInternal(nextTabId);
    };

    const shouldRedirectToItem = Boolean(
        data
        && !routeTabId
        && !data.tabs.length
        && !data.shelves.length
        && data.hero?.href
        && data.hero.kind === 'item'
    );

    return useMemo(() => ({
        data,
        error,
        seasonRows,
        visibleRows,
        hasGroupedTabs,
        activeSeasonId,
        setActiveSeasonId,
        activeGroupedTabId,
        groupedActiveShelf,
        loadingShelfIds,
        loadingTabIds,
        tabErrors,
        loadMoreShelf,
        activateGroupedTab,
        shouldRedirectToItem
    }), [
        data,
        error,
        seasonRows,
        visibleRows,
        hasGroupedTabs,
        activeSeasonId,
        activeGroupedTabId,
        groupedActiveShelf,
        loadingShelfIds,
        loadingTabIds,
        tabErrors,
        shouldRedirectToItem
    ]);
}
