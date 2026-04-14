import React, { type FormEvent, type PropsWithChildren, type ReactNode, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import Page from 'components/Page';
import type { ProviderNavLink } from '../providerTypes';

type ProviderPageLayoutProps = PropsWithChildren<{
    id: string
    title: string
    pageClassName?: string
    query?: string
    searchPlaceholder: string
    searchRoute: string
    navLinks: ProviderNavLink[]
    renderHeaderExtra?: ReactNode
}>;

export default function ProviderPageLayout({
    id,
    title,
    pageClassName = 'ardPage',
    query = '',
    searchPlaceholder,
    searchRoute,
    navLinks,
    renderHeaderExtra = null,
    children
}: ProviderPageLayoutProps) {
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState(query);

    useEffect(() => {
        setSearchQuery(query);
    }, [query]);

    const onSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const trimmed = searchQuery.trim();
        if (trimmed) {
            navigate(`${searchRoute}?query=${encodeURIComponent(trimmed)}`);
        }
    };

    return (
        <Page
            id={id}
            title={title}
            className={`mainAnimatedPage libraryPage noSecondaryNavPage ${pageClassName}`}
        >
            <div className='padded-left padded-right padded-bottom-page'>
                <header className='ardPage-header'>
                    <div className='ardPage-nav'>
                        {navLinks.map((link) => (
                            <Link key={link.to} to={link.to}>{link.label}</Link>
                        ))}
                    </div>
                    <form className='ardPage-search' onSubmit={onSubmit}>
                        <input
                            type='search'
                            value={searchQuery}
                            onChange={(event) => setSearchQuery(event.target.value)}
                            placeholder={searchPlaceholder}
                        />
                        <button type='submit'>Suchen</button>
                    </form>
                    {renderHeaderExtra}
                </header>
                {children}
            </div>
        </Page>
    );
}
