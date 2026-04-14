import React from 'react';
import { Link } from 'react-router-dom';

import { fetchZdfHome } from 'apps/stable/features/zdf/api';
import FeedPageView from 'apps/stable/features/feed/components/FeedPageView';
import { useAsyncFeedPage } from 'apps/stable/features/feed/useAsyncFeedPage';
import ZdfPageLayout from 'apps/stable/features/zdf/components/ZdfPageLayout';
import { mapZdfHomeResponseToFeedPage, resolveZdfFeedCardHref } from 'apps/stable/features/zdf/feed';
import { ZDF_PROVIDER } from 'apps/stable/features/zdf/provider';

const QUICK_LINKS: Array<{ title: string; href: string } | { title: string; query: string }> = [
    { title: 'Kategorien', href: ZDF_PROVIDER.routes.categories || '/zdfcategories' },
    { title: 'Aktuelles', query: 'heute' },
    { title: 'Krimi', query: 'krimi' },
    { title: 'Dokus', query: 'doku' },
    { title: 'Serien', query: 'serie' },
    { title: 'Filme', query: 'film' },
    { title: 'Terra X', query: 'terra x' }
];

export default function ZdfHome() {
    const { data, error } = useAsyncFeedPage(
        async () => mapZdfHomeResponseToFeedPage(await fetchZdfHome()),
        []
    );

    return (
        <ZdfPageLayout id='zdfHomePage' title={data?.title || 'ZDF'}>
            <FeedPageView
                data={data}
                error={error}
                loadingLabel='Loading ZDF home…'
                resolveHref={resolveZdfFeedCardHref}
                renderHeroActions={(hero) => (
                    <>
                        {hero.href ? (
                            <Link className='ardButton ardButton--primary' to={resolveZdfFeedCardHref(hero)}>Open Hero</Link>
                        ) : (
                            <Link className='ardButton ardButton--primary' to={`${ZDF_PROVIDER.routes.search}?query=heute`}>Search News</Link>
                        )}
                        <Link className='ardButton' to={ZDF_PROVIDER.routes.categories || '/zdfcategories'}>Kategorien</Link>
                        <Link className='ardButton' to={`${ZDF_PROVIDER.routes.search}?query=krimi`}>Browse Krimi</Link>
                        <Link className='ardButton' to={`${ZDF_PROVIDER.routes.search}?query=serie`}>Browse Series</Link>
                    </>
                )}
                renderBeforeShelves={() => (
                    <div className='zdfQuickLinks'>
                        {QUICK_LINKS.map((item) => (
                            'href' in item ? (
                                <Link key={item.href} className='ardButton' to={item.href}>
                                    {item.title}
                                </Link>
                            ) : (
                                <Link key={item.query} className='ardButton' to={`${ZDF_PROVIDER.routes.search}?query=${encodeURIComponent(item.query)}`}>
                                    {item.title}
                                </Link>
                            )
                        ))}
                    </div>
                )}
            />
        </ZdfPageLayout>
    );
}
