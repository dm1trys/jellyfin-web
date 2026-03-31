import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { fetchArdPage } from 'apps/stable/features/ard/api';
import ArdPageLayout from 'apps/stable/features/ard/components/ArdPageLayout';
import ArdShelf from 'apps/stable/features/ard/components/ArdShelf';
import type { ArdHomeResponse } from 'apps/stable/features/ard/types';

const normalizeArdHref = (href: string | null) => {
    if (!href) {
        return null;
    }

    return href.replace(/^\/ard\/item\//, '/arditem/');
};

export default function ArdPage() {
    const [searchParams] = useSearchParams();
    const href = searchParams.get('href') || '';
    const [data, setData] = useState<ArdHomeResponse | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;

        if (!href) {
            setData(null);
            setError('Missing ARD page href');
            return () => {
                isMounted = false;
            };
        }

        fetchArdPage(href)
            .then((result) => {
                if (isMounted) {
                    setData(result);
                    setError(null);
                }
            })
            .catch((fetchError) => {
                if (isMounted) {
                    setError(fetchError instanceof Error ? fetchError.message : 'Failed to load ARD page');
                }
            });

        return () => {
            isMounted = false;
        };
    }, [href]);

    return (
        <ArdPageLayout id='ardGenericPage' title={data?.title || 'ARD Page'}>
            {!data && !error ? <div className='ardState'>Loading page…</div> : null}
            {error ? <div className='ardState'>{error}</div> : null}
            {data ? (
                <>
                    {data.hero[0] ? (
                        <section className='ardDetail'>
                            {data.hero[0].image?.url ? (
                                <img className='ardHero-image' src={data.hero[0].image.url || ''} alt={data.hero[0].image.alt || data.hero[0].title || 'ARD'} />
                            ) : (
                                <div className='ardHero-image' />
                            )}
                            <div>
                                <h1 className='ardHero-title'>{data.hero[0].title || data.title}</h1>
                                {data.hero[0].subtitle ? <div className='ardCard-subtitle'>{data.hero[0].subtitle}</div> : null}
                                {data.hero[0].description ? <p className='ardHero-description'>{data.hero[0].description}</p> : null}
                                {data.hero[0].href ? (
                                    <div className='ardHero-actions'>
                                        <a className='ardButton ardButton--primary' href={normalizeArdHref(data.hero[0].href) || '#'}>
                                            Open
                                        </a>
                                    </div>
                                ) : null}
                            </div>
                        </section>
                    ) : null}
                    {data.rows.map((row) => (
                        <ArdShelf key={row.id} title={row.title} items={row.items} />
                    ))}
                </>
            ) : null}
        </ArdPageLayout>
    );
}
