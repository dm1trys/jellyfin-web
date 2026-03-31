import React, { type FC, type FormEvent, type PropsWithChildren, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import Page from 'components/Page';

import '../style.scss';

type ArdPageLayoutProps = PropsWithChildren<{
    id: string
    title: string
    query?: string
}>;

const ArdPageLayout: FC<ArdPageLayoutProps> = ({ id, title, query = '', children }) => {
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState(query);

    const onSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const trimmed = searchQuery.trim();
        if (trimmed) {
            navigate(`/ardsearch?query=${encodeURIComponent(trimmed)}`);
        }
    };

    return (
        <Page
            id={id}
            title={title}
            className='mainAnimatedPage libraryPage noSecondaryNavPage ardPage'
        >
            <div className='padded-left padded-right padded-bottom-page'>
                <header className='ardPage-header'>
                    <div className='ardPage-nav'>
                        <Link to='/ardhome'>ARD</Link>
                        <Link to='/ardsearch'>Suche</Link>
                    </div>
                    <form className='ardPage-search' onSubmit={onSubmit}>
                        <input
                            type='search'
                            value={searchQuery}
                            onChange={(event) => setSearchQuery(event.target.value)}
                            placeholder='ARD Mediathek durchsuchen'
                        />
                        <button type='submit'>Suchen</button>
                    </form>
                </header>
                {children}
            </div>
        </Page>
    );
};

export default ArdPageLayout;
