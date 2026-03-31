import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { fetchArdHome } from 'apps/stable/features/ard/api';
import ArdPageLayout from 'apps/stable/features/ard/components/ArdPageLayout';
import ArdShelf from 'apps/stable/features/ard/components/ArdShelf';
import type { ArdHomeResponse } from 'apps/stable/features/ard/types';

const normalizeArdHref = (href: string | null) => {
    if (!href) {
        return null;
    }

    const normalized = href
        .replace(/^\/ard\/item\//, '/arditem/')
        .replace(/^\/ardpage\?href=/, '/ardpage?href=')
        .replace(/^https?:\/\/api\.ardmediathek\.de\/page-gateway\/pages\/[^/]+\/item\/([^/?#]+).*$/i, '/arditem/$1');

    return normalized;
};

export default function ArdHome() {
    const [data, setData] = useState<ArdHomeResponse | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;

        fetchArdHome()
            .then((result) => {
                if (isMounted) {
                    setData(result);
                }
            })
            .catch((fetchError) => {
                if (isMounted) {
                    setError(fetchError instanceof Error ? fetchError.message : 'Failed to load ARD home');
                }
            });

        return () => {
            isMounted = false;
        };
    }, []);

    const hero = data?.hero?.[0] || null;

    return (
        <ArdPageLayout id='ardHomePage' title='ARD Mediathek'>
            {!data && !error ? <div className='ardState'>Loading ARD home…</div> : null}
            {error ? <div className='ardState'>{error}</div> : null}
            {hero ? (
                <section className='ardHero'>
                    {hero.image?.url ? <img className='ardHero-image' src={hero.image.url} alt={hero.image.alt || hero.title || 'ARD'} /> : <div className='ardHero-image' />}
                    <div>
                        <h1 className='ardHero-title'>{hero.title}</h1>
                        {hero.description ? <p className='ardHero-description'>{hero.description}</p> : null}
                        <div className='ardHero-actions'>
                            {hero.href ? <Link className='ardButton ardButton--primary' to={normalizeArdHref(hero.href) || '#'}>Open</Link> : null}
                            <Link className='ardButton' to='/ardsearch'>Search</Link>
                        </div>
                    </div>
                </section>
            ) : null}
            {(data?.rows || []).map((row) => (
                <ArdShelf key={row.id} title={row.title} items={row.items} />
            ))}
        </ArdPageLayout>
    );
}
