import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

import { fetchArdItem, fetchArdPlay } from 'apps/stable/features/ard/api';
import ArdPageLayout from 'apps/stable/features/ard/components/ArdPageLayout';
import ArdShelf from 'apps/stable/features/ard/components/ArdShelf';
import { playArdItem } from 'apps/stable/features/ard/playback';
import type { ArdItemDetailResponse } from 'apps/stable/features/ard/types';
import { ServerConnections } from 'lib/jellyfin-apiclient';

const subtitleLabel = (subtitle: { lang?: string | null; kind?: string | null; format?: string | null }) => {
    const parts = [];

    if (subtitle.lang) {
        parts.push(subtitle.lang);
    }

    if (subtitle.kind) {
        parts.push(subtitle.kind);
    }

    if (subtitle.format) {
        parts.push(subtitle.format);
    }

    return parts.length ? parts.join(' • ') : 'Subtitle track';
};

const getCurrentUserAgeRating = async () => {
    const apiClient = ServerConnections.currentApiClient();
    if (!apiClient) {
        return null;
    }

    try {
        const user = await apiClient.getCurrentUser();
        const ageRating = user?.Policy?.MaxParentalRating;
        return typeof ageRating === 'number' && Number.isFinite(ageRating) ? ageRating : null;
    } catch (_error) {
        return null;
    }
};

export default function ArdItem() {
    const { id = '' } = useParams();
    const [data, setData] = useState<ArdItemDetailResponse | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [ageRating, setAgeRating] = useState<number | null>(null);

    useEffect(() => {
        let isMounted = true;

        if (!id) {
            setError('Missing ARD item id');
            return () => {
                isMounted = false;
            };
        }

        getCurrentUserAgeRating()
            .then(async (resolvedAgeRating) => {
                if (isMounted) {
                    setAgeRating(resolvedAgeRating);
                }

                return fetchArdItem(id, resolvedAgeRating);
            })
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
    const subtitleTracks = [
        ...(data?.playback?.subtitles || []),
        ...((data?.playback?.streams || []).flatMap((group) => (
            Array.isArray(group?.media)
                ? group.media.flatMap((media) => Array.isArray(media?.subtitles) ? media.subtitles : [])
                : []
        )))
    ].filter((subtitle, index, list) => (
        Boolean(subtitle?.url) && list.findIndex((entry) => entry?.url === subtitle?.url) === index
    ));
    const playbackRestriction = data?.playback?.restriction || null;

    const onPlay = async () => {
        if (!data || !id || isPlaying || !hasPlayableStream) {
            return;
        }

        try {
            setIsPlaying(true);
            const playback = await fetchArdPlay(id, ageRating);
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
                                    <>
                                        <button type='button' className='ardButton ardButton--primary' onClick={onPlay} disabled={isPlaying}>
                                            {isPlaying ? 'Starting…' : 'Play'}
                                        </button>
                                        {!subtitleTracks.length ? (
                                            <p className='ardHero-description'>
                                                ARD does not provide subtitle tracks for this video, so pause translation is unavailable.
                                            </p>
                                        ) : null}
                                    </>
                                ) : (
                                    <>
                                        <button type='button' className='ardButton ardButton--primary' disabled>
                                            {playbackRestriction?.message || 'No playable stream available'}
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
                    <section className='ardSubtitleSection'>
                        <h2 className='ardSubtitleSection-title'>Subtitles</h2>
                        {subtitleTracks.length ? (
                            <ul className='ardSubtitleList'>
                                {subtitleTracks.map((subtitle) => (
                                    <li key={subtitle.url || subtitleLabel(subtitle)} className='ardSubtitleList-item'>
                                        <span>{subtitleLabel(subtitle)}</span>
                                        {subtitle.url ? (
                                            <a href={subtitle.url} target='_blank' rel='noreferrer'>
                                                Source
                                            </a>
                                        ) : null}
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className='ardHero-description'>
                                No subtitle tracks are available from ARD for this item.
                            </p>
                        )}
                    </section>
                    {data.relatedRows.map((row) => (
                        <ArdShelf key={row.id} title={row.title} items={row.items} />
                    ))}
                </>
            ) : null}
        </ArdPageLayout>
    );
}
