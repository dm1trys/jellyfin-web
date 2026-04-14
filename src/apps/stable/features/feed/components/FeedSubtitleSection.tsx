import React from 'react';

type SubtitleLike = {
    kind?: string | null
    lang?: string | null
    format?: string | null
    url?: string | null
};

type FeedSubtitleSectionProps = {
    providerLabel: string
    subtitles: SubtitleLike[]
};

const subtitleLabel = (subtitle: SubtitleLike) => {
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

export default function FeedSubtitleSection({
    providerLabel,
    subtitles
}: FeedSubtitleSectionProps) {
    return (
        <section className='ardSubtitleSection'>
            <h2 className='ardSubtitleSection-title'>Subtitles</h2>
            {subtitles.length ? (
                <ul className='ardSubtitleList'>
                    {subtitles.map((subtitle) => (
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
                    {`No subtitle tracks are available from ${providerLabel} for this item.`}
                </p>
            )}
        </section>
    );
}
