import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { fetchArdSearch } from 'apps/stable/features/ard/api';
import ArdPageLayout from 'apps/stable/features/ard/components/ArdPageLayout';
import ArdShelf from 'apps/stable/features/ard/components/ArdShelf';
import type { ArdSearchResponse } from 'apps/stable/features/ard/types';

export default function ArdSearch() {
    const [searchParams] = useSearchParams();
    const query = (searchParams.get('query') || '').trim();
    const [data, setData] = useState<ArdSearchResponse | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;

        if (!query) {
            setData(null);
            setError(null);
            return () => {
                isMounted = false;
            };
        }

        fetchArdSearch(query)
            .then((result) => {
                if (isMounted) {
                    setData(result);
                    setError(null);
                }
            })
            .catch((fetchError) => {
                if (isMounted) {
                    setError(fetchError instanceof Error ? fetchError.message : 'Search failed');
                }
            });

        return () => {
            isMounted = false;
        };
    }, [query]);

    return (
        <ArdPageLayout id='ardSearchPage' title='ARD Suche' query={query}>
            {!query ? <div className='ardState'>Enter a query to search ARD Mediathek.</div> : null}
            {query && !data && !error ? <div className='ardState'>Searching…</div> : null}
            {error ? <div className='ardState'>{error}</div> : null}
            {data ? (
                <>
                    <ArdShelf title='Shows' items={data.shows} />
                    <ArdShelf title='Videos' items={data.videos} />
                </>
            ) : null}
        </ArdPageLayout>
    );
}
