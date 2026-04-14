import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { fetchZdfSearch } from 'apps/stable/features/zdf/api';
import type { FeedShelfBlock } from 'apps/stable/features/feed/types';
import FeedPageView from 'apps/stable/features/feed/components/FeedPageView';
import FeedShelf from 'apps/stable/features/feed/components/FeedShelf';
import { useAsyncFeedPage } from 'apps/stable/features/feed/useAsyncFeedPage';
import ZdfPageLayout from 'apps/stable/features/zdf/components/ZdfPageLayout';
import { mapZdfSearchResponseToFeedPage, resolveZdfFeedCardHref } from 'apps/stable/features/zdf/feed';

export default function ZdfSearch() {
    const [searchParams] = useSearchParams();
    const query = (searchParams.get('query') || '').trim();
    const [loadingMore, setLoadingMore] = useState(false);
    const { data, error, setData, setError } = useAsyncFeedPage(
        async () => mapZdfSearchResponseToFeedPage(await fetchZdfSearch(query)),
        [query],
        {
            enabled: Boolean(query)
        }
    );

    React.useEffect(() => {
        setLoadingMore(false);
    }, [query]);

    const loadMore = () => {
        const shelf = data?.shelves[0];
        if (!shelf?.paging?.nextCursor || loadingMore) {
            return;
        }

        setLoadingMore(true);
        fetchZdfSearch(query, shelf.paging.nextCursor)
            .then((result) => {
                const nextPage = mapZdfSearchResponseToFeedPage(result);
                setData((current) => current ? {
                    ...nextPage,
                    shelves: current.shelves.map((currentShelf, index) => {
                        const nextShelf = nextPage.shelves[index];
                        if (!nextShelf) {
                            return currentShelf;
                        }

                        return {
                            ...nextShelf,
                            items: [...currentShelf.items, ...nextShelf.items]
                        };
                    })
                } : nextPage);
                setError(null);
            })
            .catch((fetchError) => {
                setError(fetchError instanceof Error ? fetchError.message : 'ZDF search failed');
            })
            .finally(() => {
                setLoadingMore(false);
            });
    };

    const shelf = data?.shelves[0] as FeedShelfBlock | undefined;

    return (
        <ZdfPageLayout id='zdfSearchPage' title='ZDF Suche' query={query}>
            {!query ? <div className='ardState'>Enter a query to search ZDF.</div> : null}
            {query ? (
                <FeedPageView
                    data={data}
                    error={error}
                    loadingLabel='Searching ZDF…'
                    emptyLabel={`No ZDF videos found for “${query}”.`}
                    resolveHref={resolveZdfFeedCardHref}
                    renderShelf={(currentShelf) => (
                        <FeedShelf
                            key={currentShelf.id}
                            title={currentShelf.title || 'Videos'}
                            items={currentShelf.items}
                            hasMore={Boolean(currentShelf.paging?.hasMore)}
                            loadingMore={loadingMore}
                            onLoadMore={currentShelf.id === shelf?.id ? loadMore : undefined}
                            resolveHref={resolveZdfFeedCardHref}
                        />
                    )}
                />
            ) : null}
        </ZdfPageLayout>
    );
}
