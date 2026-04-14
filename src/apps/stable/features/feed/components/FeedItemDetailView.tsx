import React, { type ReactNode } from 'react';

import type { FeedImage } from '../types';

type FeedItemDetailViewProps = {
    providerLabel: string
    title: string | null
    subtitle?: string | null
    description?: string | null
    image?: FeedImage | null
    meta?: ReactNode
    metaItems?: Array<string | null | undefined | false>
    actions?: ReactNode
    afterActions?: ReactNode
};

export default function FeedItemDetailView({
    providerLabel,
    title,
    subtitle = null,
    description = null,
    image = null,
    meta = null,
    metaItems = [],
    actions = null,
    afterActions = null
}: FeedItemDetailViewProps) {
    const resolvedMetaItems = metaItems.filter((item): item is string => Boolean(item));
    const resolvedMeta = meta || resolvedMetaItems.map((item) => (
        <span key={item} className='ardDetail-metaItem'>{item}</span>
    ));

    return (
        <section className='ardDetail'>
            {image?.url ? (
                <img className='ardHero-image' src={image.url || ''} alt={image.alt || title || providerLabel} />
            ) : (
                <div className='ardHero-image' />
            )}
            <div>
                <h1 className='ardHero-title'>{title || providerLabel}</h1>
                {subtitle ? <div className='ardCard-subtitle'>{subtitle}</div> : null}
                {(meta || resolvedMetaItems.length) ? <div className='ardDetail-meta'>{resolvedMeta}</div> : null}
                {description ? <p className='ardHero-description'>{description}</p> : null}
                {actions ? <div className='ardHero-actions'>{actions}</div> : null}
                {afterActions}
            </div>
        </section>
    );
}
