import React, { type FC } from 'react';

import FeedShelf from 'apps/stable/features/feed/components/FeedShelf';

import { resolveArdFeedCardHref } from '../feed';
import type { ArdItem } from '../types';

type ArdShelfProps = {
    title: string | null
    items: ArdItem[]
};

const ArdShelf: FC<ArdShelfProps> = ({ title, items }) => {
    return (
        <FeedShelf
            title={title || 'ARD'}
            items={items.map((item) => ({
                id: item.id || item.href || item.title || 'ard-item',
                provider: 'ard',
                kind: item.playable || item.kind === 'movie' || item.kind === 'episode' || item.kind === 'item' || item.kind === 'live'
                    ? 'item'
                    : item.kind === 'collection'
                        ? 'collection'
                        : 'page',
                title: item.title,
                subtitle: item.subtitle,
                description: item.description,
                image: item.image,
                badges: item.badges,
                href: item.href,
                playableHref: item.playable ? item.href : null
            }))}
            resolveHref={resolveArdFeedCardHref}
        />
    );
};

export default ArdShelf;
