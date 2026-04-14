import React from 'react';
import { useSearchParams } from 'react-router-dom';

import { fetchArdSearch } from 'apps/stable/features/ard/api';
import { mapArdSearchResponseToFeedPage, resolveArdFeedCardHref } from 'apps/stable/features/ard/feed';
import ArdPageLayout from 'apps/stable/features/ard/components/ArdPageLayout';
import FeedPageView from 'apps/stable/features/feed/components/FeedPageView';
import { useAsyncFeedPage } from 'apps/stable/features/feed/useAsyncFeedPage';

export default function ArdSearch() {
    const [searchParams] = useSearchParams();
    const query = (searchParams.get('query') || '').trim();
    const { data, error } = useAsyncFeedPage(
        async () => mapArdSearchResponseToFeedPage(await fetchArdSearch(query)),
        [query],
        {
            enabled: Boolean(query)
        }
    );

    return (
        <ArdPageLayout id='ardSearchPage' title='ARD Suche' query={query}>
            {!query ? <div className='ardState'>Enter a query to search ARD Mediathek.</div> : null}
            {query ? (
                <FeedPageView
                    data={data}
                    error={error}
                    loadingLabel='Searching…'
                    emptyLabel={`No ARD results found for “${query}”.`}
                    resolveHref={resolveArdFeedCardHref}
                />
            ) : null}
        </ArdPageLayout>
    );
}
