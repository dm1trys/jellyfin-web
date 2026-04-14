import React, { type FC, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

import type { FeedCard } from '../types';

type FeedShelfProps = {
    sectionId?: string
    title: string
    items: FeedCard[]
    hasMore?: boolean
    loadingMore?: boolean
    onLoadMore?: () => void
    resolveHref: (item: FeedCard) => string
    autoLoadMore?: boolean
};

const FeedShelf: FC<FeedShelfProps> = ({
    sectionId,
    title,
    items,
    hasMore,
    loadingMore,
    onLoadMore,
    resolveHref,
    autoLoadMore = false
}) => {
    const loadMoreRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!autoLoadMore || !hasMore || !onLoadMore || loadingMore || !loadMoreRef.current) {
            return undefined;
        }

        const observer = new IntersectionObserver((entries) => {
            if (entries.some((entry) => entry.isIntersecting)) {
                onLoadMore();
            }
        }, {
            rootMargin: '480px 0px'
        });

        observer.observe(loadMoreRef.current);

        return () => {
            observer.disconnect();
        };
    }, [autoLoadMore, hasMore, loadingMore, onLoadMore]);

    if (!items.length) {
        return null;
    }

    return (
        <section id={sectionId} className='ardShelf'>
            <h2 className='ardShelf-title'>{title}</h2>
            <div className='ardShelf-grid'>
                {items.map((item) => (
                    <Link
                        key={item.id}
                        className='ardCard'
                        to={resolveHref(item)}
                    >
                        <div className='ardCard-imageWrap'>
                            {item.image?.url ? (
                                <img className='ardCard-image' src={item.image.url} alt={item.image.alt || item.title || item.provider} loading='lazy' decoding='async' />
                            ) : (
                                <div className='ardCard-imagePlaceholder' />
                            )}
                        </div>
                        <div className='ardCard-body'>
                            <div className='ardCard-title'>{item.title}</div>
                            {item.subtitle ? <div className='ardCard-subtitle'>{item.subtitle}</div> : null}
                            {!!item.badges.length && (
                                <div className='ardCard-badges'>
                                    {item.badges.slice(0, 3).map((badge) => (
                                        <span key={badge} className='ardCard-badge'>{badge}</span>
                                    ))}
                                </div>
                            )}
                        </div>
                    </Link>
                ))}
            </div>
            {hasMore && onLoadMore ? (
                <div ref={loadMoreRef} className='zdfShelf-actions'>
                    <button type='button' className='ardButton' onClick={onLoadMore} disabled={loadingMore}>
                        {loadingMore ? 'Loading…' : 'Load more'}
                    </button>
                </div>
            ) : null}
        </section>
    );
};

export default FeedShelf;
