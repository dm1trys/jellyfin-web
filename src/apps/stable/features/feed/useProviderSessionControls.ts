import { useEffect, useState } from 'react';

type UseProviderSessionControlsOptions<TSession> = {
    loadSession: () => Promise<TSession>
    connectSession: () => Promise<TSession>
    disconnectSession: () => Promise<void>
    getInitialState: () => {
        connected: boolean
        connectEnabled: boolean
        status: string
    }
    mapLoadedState: (session: TSession) => {
        connected: boolean
        connectEnabled: boolean
        status: string
    }
    getConnectFailureStatus: () => string
    getDisconnectFailureStatus: () => string
    getLoadFailureStatus: () => string
};

export function useProviderSessionControls<TSession>({
    loadSession,
    connectSession,
    disconnectSession,
    getInitialState,
    mapLoadedState,
    getConnectFailureStatus,
    getDisconnectFailureStatus,
    getLoadFailureStatus
}: UseProviderSessionControlsOptions<TSession>) {
    const initialState = getInitialState();
    const [connected, setConnected] = useState(initialState.connected);
    const [connectEnabled, setConnectEnabled] = useState(initialState.connectEnabled);
    const [status, setStatus] = useState(initialState.status);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        let cancelled = false;

        loadSession()
            .then((session) => {
                if (cancelled) {
                    return;
                }

                const nextState = mapLoadedState(session);
                setConnected(nextState.connected);
                setConnectEnabled(nextState.connectEnabled);
                setStatus(nextState.status);
            })
            .catch(() => {
                if (!cancelled) {
                    setStatus(getLoadFailureStatus());
                }
            });

        return () => {
            cancelled = true;
        };
    // Provider session bootstrap should run once on mount.
    // Callers may pass inline adapters, so keep lifecycle explicit here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const connect = async () => {
        setBusy(true);

        try {
            const session = await connectSession();
            const nextState = mapLoadedState(session);
            setConnected(nextState.connected);
            setConnectEnabled(nextState.connectEnabled);
            setStatus(nextState.status);
        } catch (_error) {
            setStatus(getConnectFailureStatus());
        } finally {
            setBusy(false);
        }
    };

    const disconnect = async () => {
        setBusy(true);

        try {
            await disconnectSession();
            setConnected(false);
            setStatus('Disconnected');
        } catch (_error) {
            setStatus(getDisconnectFailureStatus());
        } finally {
            setBusy(false);
        }
    };

    return {
        connected,
        connectEnabled,
        status,
        busy,
        connect,
        disconnect,
        setStatus
    };
}
