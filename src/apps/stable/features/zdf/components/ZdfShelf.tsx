import React, { type FC } from 'react';

import FeedShelf from 'apps/stable/features/feed/components/FeedShelf';
import type { ZdfBrowseItem } from '../types';
import { resolveZdfFeedCardHref } from '../feed';

type ZdfShelfProps = {
    sectionId?: string
    title: string
    items: ZdfBrowseItem[]
    hasMore?: boolean
    loadingMore?: boolean
    onLoadMore?: () => void
};

const ZdfShelf: FC<ZdfShelfProps> = ({ sectionId, title, items, hasMore, loadingMore, onLoadMore }) => {
    return (
        <FeedShelf
            sectionId={sectionId}
            title={title}
            items={items.map((item) => ({
                id: item.id || item.href || item.title || 'zdf-item',
                provider: 'zdf',
                kind: item.kind === 'video' || item.kind === 'item' ? 'item' : 'page',
                title: item.title,
                subtitle: item.subtitle,
                description: item.description,
                image: item.image,
                badges: item.badges,
                href: item.href,
                playableHref: item.kind === 'video' || item.kind === 'item' ? item.href : null
            }))}
            hasMore={hasMore}
            loadingMore={loadingMore}
            onLoadMore={onLoadMore}
            resolveHref={resolveZdfFeedCardHref}
        />
    );
};

export default ZdfShelf;
