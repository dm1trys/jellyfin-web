import React, { type FC, type PropsWithChildren } from 'react';

import ProviderPageLayout from 'apps/stable/features/feed/components/ProviderPageLayout';
import ProviderSessionActions from 'apps/stable/features/feed/components/ProviderSessionActions';
import { useProviderSessionControls } from 'apps/stable/features/feed/useProviderSessionControls';
import { clearArdSession, fetchArdSession, loginArdSession } from '../api';
import { ARD_PROVIDER } from '../provider';
import type { ArdSessionResponse } from '../types';
import '../style.scss';

type ArdPageLayoutProps = PropsWithChildren<{
    id: string
    title: string
    query?: string
}>;

const ArdPageLayout: FC<ArdPageLayoutProps> = ({ id, title, query = '', children }) => {
    const describeSession = (session: ArdSessionResponse) => ({
        connected: session.connected,
        connectEnabled: session.hasLoginCredentials,
        status: session.connected
            ? `ARD account connected${session.userId ? `: ${session.userId}` : ''}`
            : session.hasLoginCredentials
                ? 'ARD account not connected'
                : 'ARD login credentials are not configured'
    });
    const {
        connected,
        connectEnabled,
        status,
        busy,
        connect,
        disconnect,
        setStatus
    } = useProviderSessionControls({
        loadSession: fetchArdSession,
        connectSession: async () => {
            const session = await loginArdSession();
            if (!session.connected) {
                setStatus('ARD login completed, but session is incomplete');
            }
            return session;
        },
        disconnectSession: clearArdSession,
        getInitialState: () => ({
            connected: false,
            connectEnabled: false,
            status: 'ARD account not connected'
        }),
        mapLoadedState: describeSession,
        getLoadFailureStatus: () => 'Could not load ARD account session',
        getConnectFailureStatus: () => 'Could not log in to ARD account',
        getDisconnectFailureStatus: () => 'Could not clear ARD account session'
    });

    const onDisconnectArd = async () => {
        try {
            await disconnect();
            setStatus('ARD account disconnected');
        } catch (_error) {
            // unreachable, hook already handles error state
        }
    };

    return (
        <ProviderPageLayout
            id={id}
            title={title}
            query={query}
            searchPlaceholder={ARD_PROVIDER.searchPlaceholder}
            searchRoute={ARD_PROVIDER.routes.search}
            navLinks={ARD_PROVIDER.navLinks}
            renderHeaderExtra={(
                <ProviderSessionActions
                    connectLabel='Verbinden'
                    disconnectLabel='Trennen'
                    connected={connected}
                    connectEnabled={connectEnabled}
                    busy={busy}
                    status={status}
                    onConnect={connect}
                    onDisconnect={onDisconnectArd}
                />
            )}
        >
            {children}
        </ProviderPageLayout>
    );
};

export default ArdPageLayout;
