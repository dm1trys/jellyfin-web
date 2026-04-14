import React, { useCallback } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';

import { fetchZdfPage } from 'apps/stable/features/zdf/api';
import { useFeedBrowsePage } from 'apps/stable/features/feed/useFeedBrowsePage';
import ZdfPageLayout from 'apps/stable/features/zdf/components/ZdfPageLayout';
import FeedShelf from 'apps/stable/features/feed/components/FeedShelf';
import { mapZdfHomeResponseToFeedPage, resolveZdfFeedCardHref } from 'apps/stable/features/zdf/feed';

export default function ZdfPage() {
    const [searchParams] = useSearchParams();
    const href = searchParams.get('href') || '';
    const tabId = searchParams.get('tabId') || '';
    const loadPage = useCallback(
        async (nextTabId = '', rowId = '', after = '') => (
            mapZdfHomeResponseToFeedPage(await fetchZdfPage(href, nextTabId, rowId, after))
        ),
        [href]
    );
    const {
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
    } = useFeedBrowsePage(
        href,
        tabId,
        loadPage
    );

    return (
        <ZdfPageLayout id='zdfGenericPage' title={data?.title || 'ZDF Page'}>
            {shouldRedirectToItem ? <Navigate replace to={resolveZdfFeedCardHref(data?.hero || {
                id: href,
                provider: 'zdf',
                kind: 'item',
                title: null,
                subtitle: null,
                description: null,
                image: null,
                badges: [],
                href,
                playableHref: href
            })} /> : null}
            {!data && !error ? <div className='ardState'>Loading page…</div> : null}
            {error ? <div className='ardState'>{error}</div> : null}
            {data ? (
                <>
                    {data.hero ? (
                        <section className='ardHero'>
                            {data.hero.image?.url ? (
                                <img className='ardHero-image' src={data.hero.image.url} alt={data.hero.image.alt || data.hero.title || data.title || 'ZDF'} loading='eager' decoding='async' />
                            ) : (
                                <div className='ardHero-image' />
                            )}
                            <div>
                                <h1 className='ardHero-title'>{data.hero.title || data.title}</h1>
                                <p className='ardHero-description'>
                                    {data.hero.description || data.description || 'ZDF browse page'}
                                </p>
                                {data.hero.href ? (
                                    <div className='ardHero-actions'>
                                        <Link className='ardButton ardButton--primary' to={resolveZdfFeedCardHref(data.hero)}>
                                            Open
                                        </Link>
                                    </div>
                                ) : null}
                            </div>
                        </section>
                    ) : null}
                    {!!data.tabs.length && href ? (
                        <div className='zdfQuickLinks'>
                            {data.tabs.map((tab) => (
                                hasGroupedTabs ? (
                                    <button
                                        key={tab.id}
                                        type='button'
                                        className={`ardButton${tab.id === activeGroupedTabId ? ' zdfQuickLinks-button--active' : ''}`}
                                        onClick={() => activateGroupedTab(tab.id)}
                                    >
                                        {tab.title || tab.id}
                                    </button>
                                ) : (
                                    <Link
                                        key={tab.id}
                                        className='ardButton'
                                        to={`/zdfpage?href=${encodeURIComponent(href)}&tabId=${encodeURIComponent(tab.id)}`}
                                    >
                                        {tab.title || tab.id}
                                    </Link>
                                )
                            ))}
                        </div>
                    ) : null}
                    {seasonRows.length > 1 ? (
                        <div className='zdfQuickLinks zdfQuickLinks--seasons'>
                            {seasonRows.map((shelf) => (
                                <button
                                    key={shelf.id}
                                    type='button'
                                    className={`ardButton${shelf.id === activeSeasonId ? ' zdfQuickLinks-button--active' : ''}`}
                                    onClick={() => setActiveSeasonId(shelf.id)}
                                >
                                    {shelf.title || shelf.id}
                                </button>
                            ))}
                        </div>
                    ) : null}
                    {visibleRows.map((shelf) => (
                        <FeedShelf
                            key={shelf.id}
                            sectionId={shelf.id}
                            title={shelf.title || data.title || 'ZDF'}
                            items={shelf.items}
                            hasMore={Boolean(shelf.paging?.hasMore && shelf.paging?.nextCursor)}
                            loadingMore={Boolean(loadingShelfIds[shelf.id])}
                            onLoadMore={() => loadMoreShelf(shelf)}
                            resolveHref={resolveZdfFeedCardHref}
                            autoLoadMore
                        />
                    ))}
                    {hasGroupedTabs && activeGroupedTabId && !groupedActiveShelf && !loadingTabIds.includes(activeGroupedTabId) ? (
                        <div className='ardState'>{tabErrors[activeGroupedTabId] || 'No section loaded yet.'}</div>
                    ) : null}
                </>
            ) : null}
        </ZdfPageLayout>
    );
}
