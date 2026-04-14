import React from 'react';
import { Link } from 'react-router-dom';

import { fetchZdfPage } from 'apps/stable/features/zdf/api';
import FeedPageView from 'apps/stable/features/feed/components/FeedPageView';
import { useAsyncFeedPage } from 'apps/stable/features/feed/useAsyncFeedPage';
import ZdfPageLayout from 'apps/stable/features/zdf/components/ZdfPageLayout';
import { mapZdfHomeResponseToFeedPage, resolveZdfFeedCardHref } from 'apps/stable/features/zdf/feed';

const CATEGORIES_HREF = 'https://www.zdf.de/kategorien';

export default function ZdfCategories() {
    const { data, error } = useAsyncFeedPage(
        async () => mapZdfHomeResponseToFeedPage(await fetchZdfPage(CATEGORIES_HREF)),
        []
    );

    return (
        <ZdfPageLayout id='zdfCategoriesPage' title={data?.title || 'Kategorien'}>
            <FeedPageView
                data={data}
                error={error}
                loadingLabel='Loading Kategorien…'
                resolveHref={resolveZdfFeedCardHref}
                renderHeroActions={(hero) => (
                    hero.href ? (
                        <Link className='ardButton ardButton--primary' to={resolveZdfFeedCardHref(hero)}>
                            Open First Category
                        </Link>
                    ) : null
                )}
                renderBeforeShelves={(currentData) => (
                    currentData.tabs.length ? (
                        <div className='zdfQuickLinks'>
                            {currentData.tabs.map((tab) => (
                                <span key={tab.id} className='ardButton' aria-disabled='true'>
                                    {tab.title || tab.id}
                                </span>
                            ))}
                        </div>
                    ) : null
                )}
            />
        </ZdfPageLayout>
    );
}
