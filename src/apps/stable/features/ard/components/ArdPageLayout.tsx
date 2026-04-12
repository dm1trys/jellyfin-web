import React, { type FC, type FormEvent, type PropsWithChildren, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import Page from 'components/Page';

import { clearArdSession, fetchArdSession, loginArdSession } from '../api';
import '../style.scss';

type ArdPageLayoutProps = PropsWithChildren<{
    id: string
    title: string
    query?: string
}>;

const ArdPageLayout: FC<ArdPageLayoutProps> = ({ id, title, query = '', children }) => {
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState(query);
    const [ardConnected, setArdConnected] = useState(false);
    const [ardLoginConfigured, setArdLoginConfigured] = useState(false);
    const [ardStatus, setArdStatus] = useState('ARD account not connected');
    const [ardBusy, setArdBusy] = useState(false);

    useEffect(() => {
        let cancelled = false;

        fetchArdSession()
            .then((session) => {
                if (cancelled) {
                    return;
                }

                setArdConnected(session.connected);
                setArdLoginConfigured(session.hasLoginCredentials);
                setArdStatus(session.connected
                    ? `ARD account connected${session.userId ? `: ${session.userId}` : ''}`
                    : session.hasLoginCredentials
                        ? 'ARD account not connected'
                        : 'ARD login credentials are not configured');
            })
            .catch(() => {
                if (!cancelled) {
                    setArdStatus('Could not load ARD account session');
                }
            });

        return () => {
            cancelled = true;
        };
    }, []);

    const onSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const trimmed = searchQuery.trim();
        if (trimmed) {
            navigate(`/ardsearch?query=${encodeURIComponent(trimmed)}`);
        }
    };

    const onConnectArd = async () => {
        setArdBusy(true);

        try {
            const session = await loginArdSession();
            setArdConnected(session.connected);
            setArdLoginConfigured(session.hasLoginCredentials);
            setArdStatus(session.connected
                ? `ARD account connected${session.userId ? `: ${session.userId}` : ''}`
                : 'ARD login completed, but session is incomplete');
        } catch (_error) {
            setArdStatus('Could not log in to ARD account');
        } finally {
            setArdBusy(false);
        }
    };

    const onDisconnectArd = async () => {
        setArdBusy(true);

        try {
            await clearArdSession();
            setArdConnected(false);
            setArdStatus('ARD account disconnected');
        } catch (_error) {
            setArdStatus('Could not clear ARD account session');
        } finally {
            setArdBusy(false);
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
                    <div className='ardPage-account'>
                        <button type='button' disabled={ardBusy || !ardLoginConfigured} onClick={onConnectArd}>
                            Verbinden
                        </button>
                        <button type='button' className='ardButton ardButton--secondary' disabled={ardBusy || !ardConnected} onClick={onDisconnectArd}>
                            Trennen
                        </button>
                        <div className='ardPage-accountStatus'>{ardStatus}</div>
                    </div>
                </header>
                {children}
            </div>
        </Page>
    );
};

export default ArdPageLayout;
