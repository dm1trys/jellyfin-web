import React from 'react';
import { Link } from 'react-router-dom';

import { fetchArdHome } from 'apps/stable/features/ard/api';
import { mapArdHomeResponseToFeedPage, resolveArdFeedCardHref } from 'apps/stable/features/ard/feed';
import ArdPageLayout from 'apps/stable/features/ard/components/ArdPageLayout';
import { ARD_PROVIDER } from 'apps/stable/features/ard/provider';
import FeedPageView from 'apps/stable/features/feed/components/FeedPageView';
import { useAsyncFeedPage } from 'apps/stable/features/feed/useAsyncFeedPage';

export default function ArdHome() {
    const { data, error } = useAsyncFeedPage(
        async () => mapArdHomeResponseToFeedPage(await fetchArdHome()),
        []
    );

    return (
        <ArdPageLayout id='ardHomePage' title='ARD Mediathek'>
            <FeedPageView
                data={data}
                error={error}
                loadingLabel='Loading ARD home…'
                resolveHref={resolveArdFeedCardHref}
                renderHeroActions={(hero) => (
                    <>
                        {hero.href ? <Link className='ardButton ardButton--primary' to={resolveArdFeedCardHref(hero)}>Open</Link> : null}
                        <Link className='ardButton' to={ARD_PROVIDER.routes.search}>Search</Link>
                    </>
                )}
            />
        </ArdPageLayout>
    );
}
