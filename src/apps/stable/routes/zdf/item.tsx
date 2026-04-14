import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';

import { fetchZdfItem, fetchZdfPlay } from 'apps/stable/features/zdf/api';
import FeedItemDetailView from 'apps/stable/features/feed/components/FeedItemDetailView';
import FeedSubtitleSection from 'apps/stable/features/feed/components/FeedSubtitleSection';
import { useAsyncData } from 'apps/stable/features/feed/useAsyncData';
import ZdfPageLayout from 'apps/stable/features/zdf/components/ZdfPageLayout';
import { mapZdfItemDetailToFeedItemDetail } from 'apps/stable/features/zdf/feed';
import { playZdfItem } from 'apps/stable/features/zdf/playback';
import { resolveZdfHref } from 'apps/stable/features/zdf/routing';
import 'apps/stable/features/zdf/style.scss';

export default function ZdfItem() {
    const params = useParams();
    const location = useLocation();
    const routePath = params['*'] || '';
    const href = useMemo(() => resolveZdfHref(routePath, location.search), [routePath, location.search]);
    const [isPlaying, setIsPlaying] = useState(false);
    const { data, error } = useAsyncData(
        async () => fetchZdfItem(href),
        [href],
        {
            enabled: Boolean(href),
            disableError: 'Missing ZDF item url',
            errorMessage: 'Failed to load ZDF item'
        }
    );
    const detail = data ? mapZdfItemDetailToFeedItemDetail(data) : null;

    const hasPlayableStream = Boolean(data?.playback?.hls);

    const onPlay = async () => {
        if (!data || !href || isPlaying || !hasPlayableStream) {
            return;
        }

        try {
            setIsPlaying(true);
            const playback = await fetchZdfPlay(href);
            await playZdfItem(data, playback);
        } finally {
            setIsPlaying(false);
        }
    };

    return (
        <ZdfPageLayout id='zdfItemPage' title={data?.title || 'ZDF Item'}>
            {!data && !error ? <div className='ardState'>Loading ZDF item…</div> : null}
            {error ? <div className='ardState'>{error}</div> : null}
            {data && detail ? (
                <>
                    <FeedItemDetailView
                        providerLabel={detail.provider}
                        title={detail.title}
                        subtitle={detail.subtitle}
                        description={detail.description}
                        image={detail.image}
                        metaItems={detail.meta}
                        actions={(
                            hasPlayableStream ? (
                                <button type='button' className='ardButton ardButton--primary' onClick={onPlay} disabled={isPlaying}>
                                    {isPlaying ? 'Starting…' : 'Play'}
                                </button>
                            ) : (
                                <button type='button' className='ardButton ardButton--primary' disabled>
                                    {detail.restriction?.message || 'No playable stream available'}
                                </button>
                            )
                        )}
                        afterActions={(
                            <>
                                {!detail.subtitles.length && hasPlayableStream ? (
                                    <p className='ardHero-description'>
                                        ZDF does not provide subtitle tracks for this video, so pause translation is unavailable.
                                    </p>
                                ) : null}
                                {!hasPlayableStream && detail.restriction?.message ? (
                                    <p className='ardHero-description'>
                                        {detail.restriction.message}
                                        {detail.restriction.maturity ? ` (${detail.restriction.maturity})` : ''}
                                    </p>
                                ) : null}
                                {detail.notes.map((note) => <p key={note} className='ardHero-description'>{note}</p>)}
                            </>
                        )}
                    />
                    <FeedSubtitleSection providerLabel={detail.provider} subtitles={detail.subtitles} />
                </>
            ) : null}
        </ZdfPageLayout>
    );
}
