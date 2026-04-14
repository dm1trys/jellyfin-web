import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { fetchArdPage } from 'apps/stable/features/ard/api';
import { mapArdHomeResponseToFeedPage, resolveArdFeedCardHref } from 'apps/stable/features/ard/feed';
import ArdPageLayout from 'apps/stable/features/ard/components/ArdPageLayout';
import FeedPageView from 'apps/stable/features/feed/components/FeedPageView';
import { useAsyncFeedPage } from 'apps/stable/features/feed/useAsyncFeedPage';

export default function ArdPage() {
    const [searchParams] = useSearchParams();
    const href = searchParams.get('href') || '';
    const { data, error } = useAsyncFeedPage(
        async () => mapArdHomeResponseToFeedPage(await fetchArdPage(href)),
        [href],
        {
            enabled: Boolean(href),
            disableError: 'Missing ARD page href'
        }
    );

    return (
        <ArdPageLayout id='ardGenericPage' title={data?.title || 'ARD Page'}>
            <FeedPageView
                data={data}
                error={error}
                loadingLabel='Loading page…'
                resolveHref={resolveArdFeedCardHref}
                renderHeroActions={(hero) => (
                    hero.href ? <Link className='ardButton ardButton--primary' to={resolveArdFeedCardHref(hero)}>Open</Link> : null
                )}
            />
        </ArdPageLayout>
    );
}
