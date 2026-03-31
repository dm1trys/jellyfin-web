import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

import { fetchArdItem, fetchArdPlay } from 'apps/stable/features/ard/api';
import ArdPageLayout from 'apps/stable/features/ard/components/ArdPageLayout';
import ArdShelf from 'apps/stable/features/ard/components/ArdShelf';
import { playArdItem } from 'apps/stable/features/ard/playback';
import type { ArdItemDetailResponse } from 'apps/stable/features/ard/types';

export default function ArdItem() {
    const { id = '' } = useParams();
    const [data, setData] = useState<ArdItemDetailResponse | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);

    useEffect(() => {
        let isMounted = true;

        if (!id) {
            setError('Missing ARD item id');
            return () => {
                isMounted = false;
            };
        }

        fetchArdItem(id)
            .then((result) => {
                if (isMounted) {
                    setData(result);
                    setError(null);
                }
            })
            .catch((fetchError) => {
                if (isMounted) {
                    setError(fetchError instanceof Error ? fetchError.message : 'Failed to load ARD item');
                }
            });

        return () => {
            isMounted = false;
        };
    }, [id]);

    const hasPlayableStream = Boolean(
        data?.playback?.streams?.some((group) =>
            Array.isArray(group?.media) && group.media.some((media) => Boolean(media?.url))
        )
    );
    const playbackRestriction = data?.playback?.restriction || null;

    const onPlay = async () => {
        if (!data || !id || isPlaying || !hasPlayableStream) {
            return;
        }

        try {
            setIsPlaying(true);
            const playback = await fetchArdPlay(id);
            await playArdItem(data, playback);
        } finally {
            setIsPlaying(false);
        }
    };

    return (
        <ArdPageLayout id='ardItemPage' title={data?.title || 'ARD Item'}>
            {!data && !error ? <div className='ardState'>Loading item…</div> : null}
            {error ? <div className='ardState'>{error}</div> : null}
            {data ? (
                <>
                    <section className='ardDetail'>
                        {data.images[0]?.url ? (
                            <img className='ardHero-image' src={data.images[0].url || ''} alt={data.images[0].alt || data.title || 'ARD'} />
                        ) : (
                            <div className='ardHero-image' />
                        )}
                        <div>
                            <h1 className='ardHero-title'>{data.title}</h1>
                            {data.seriesTitle ? <div className='ardCard-subtitle'>{data.seriesTitle}</div> : null}
                            <div className='ardDetail-meta'>
                                {typeof data.durationSeconds === 'number' ? <span className='ardDetail-metaItem'>{Math.round(data.durationSeconds / 60)} min</span> : null}
                                {data.availability.fsk ? <span className='ardDetail-metaItem'>FSK {data.availability.fsk}</span> : null}
                                {data.availability.availableTo ? <span className='ardDetail-metaItem'>Available until {new Date(data.availability.availableTo).toLocaleDateString()}</span> : null}
                            </div>
                            {data.synopsis ? <p className='ardHero-description'>{data.synopsis}</p> : null}
                            <div className='ardHero-actions'>
                                {hasPlayableStream ? (
                                    <button type='button' className='ardButton ardButton--primary' onClick={onPlay} disabled={isPlaying}>
                                        {isPlaying ? 'Starting…' : 'Play with subtitles'}
                                    </button>
                                ) : (
                                    <>
                                        <button type='button' className='ardButton ardButton--primary' disabled>
                                            {playbackRestriction?.kind === 'fsk' ? 'Playback blocked by age restriction' : 'No playable stream available'}
                                        </button>
                                        {playbackRestriction?.message ? (
                                            <p className='ardHero-description'>
                                                {playbackRestriction.message}
                                                {playbackRestriction.maturity ? ` (${playbackRestriction.maturity})` : ''}
                                            </p>
                                        ) : null}
                                    </>
                                )}
                            </div>
                        </div>
                    </section>
                    {data.relatedRows.map((row) => (
                        <ArdShelf key={row.id} title={row.title} items={row.items} />
                    ))}
                </>
            ) : null}
        </ArdPageLayout>
    );
}
