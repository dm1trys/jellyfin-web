import React, { type FC } from 'react';
import { Link } from 'react-router-dom';

import type { ArdItem } from '../types';

type ArdShelfProps = {
    title: string | null
    items: ArdItem[]
};

const normalizeArdHref = (href: string | null) => {
    if (!href) {
        return '#';
    }

    return href
        .replace(/^\/ard\/item\//, '/arditem/')
        .replace(/^\/ardpage\?href=/, '/ardpage?href=')
        .replace(/^https?:\/\/api\.ardmediathek\.de\/page-gateway\/pages\/[^/]+\/item\/([^/?#]+).*$/i, '/arditem/$1');
};

const ArdShelf: FC<ArdShelfProps> = ({ title, items }) => {
    if (!items.length) {
        return null;
    }

    return (
        <section className='ardShelf'>
            {title ? <h2 className='ardShelf-title'>{title}</h2> : null}
            <div className='ardShelf-grid'>
                {items.map((item) => (
                    <Link
                        key={`${item.id || item.href || item.title}`}
                        className='ardCard'
                        to={normalizeArdHref(item.href)}
                    >
                        <div className='ardCard-imageWrap'>
                            {item.image?.url ? (
                                <img className='ardCard-image' src={item.image.url} alt={item.image.alt || item.title || 'ARD'} loading='lazy' decoding='async' />
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
        </section>
    );
};

export default ArdShelf;
