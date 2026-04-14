import React, { type ReactNode } from 'react';

import type { FeedCard, FeedPage } from '../types';
import FeedShelf from './FeedShelf';

type FeedPageViewProps = {
    data: FeedPage | null
    error: string | null
    loadingLabel: string
    emptyLabel?: string | null
    resolveHref: (item: FeedCard) => string
    renderHeroActions?: (hero: FeedCard, data: FeedPage) => ReactNode
    renderBeforeShelves?: (data: FeedPage) => ReactNode
    renderAfterShelves?: (data: FeedPage) => ReactNode
    renderShelf?: (shelf: FeedPage['shelves'][number], data: FeedPage) => ReactNode
};

export default function FeedPageView({
    data,
    error,
    loadingLabel,
    emptyLabel = null,
    resolveHref,
    renderHeroActions,
    renderBeforeShelves,
    renderAfterShelves,
    renderShelf
}: FeedPageViewProps) {
    return (
        <>
            {!data && !error ? <div className='ardState'>{loadingLabel}</div> : null}
            {error ? <div className='ardState'>{error}</div> : null}
            {data ? (
                <>
                    {data.hero ? (
                        <section className='ardHero'>
                            {data.hero.image?.url ? (
                                <img className='ardHero-image' src={data.hero.image.url} alt={data.hero.image.alt || data.hero.title || data.title || data.provider} loading='eager' decoding='async' />
                            ) : (
                                <div className='ardHero-image' />
                            )}
                            <div>
                                <h1 className='ardHero-title'>{data.hero.title || data.title}</h1>
                                {(data.hero.description || data.description) ? (
                                    <p className='ardHero-description'>
                                        {data.hero.description || data.description}
                                    </p>
                                ) : null}
                                {renderHeroActions ? (
                                    <div className='ardHero-actions'>
                                        {renderHeroActions(data.hero, data)}
                                    </div>
                                ) : null}
                            </div>
                        </section>
                    ) : null}
                    {renderBeforeShelves ? renderBeforeShelves(data) : null}
                    {data.shelves.map((shelf) => (
                        renderShelf
                            ? <React.Fragment key={shelf.id}>{renderShelf(shelf, data)}</React.Fragment>
                            : <FeedShelf key={shelf.id} title={shelf.title || data.title || data.provider} items={shelf.items} resolveHref={resolveHref} />
                    ))}
                    {!data.shelves.some((shelf) => shelf.items.length) && emptyLabel ? (
                        <div className='ardState'>{emptyLabel}</div>
                    ) : null}
                    {renderAfterShelves ? renderAfterShelves(data) : null}
                </>
            ) : null}
        </>
    );
}
