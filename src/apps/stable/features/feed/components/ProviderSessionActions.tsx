import React from 'react';

type ProviderSessionActionsProps = {
    connectLabel?: string
    disconnectLabel?: string
    connected: boolean
    connectEnabled: boolean
    busy: boolean
    status: string
    onConnect: () => void | Promise<void>
    onDisconnect: () => void | Promise<void>
};

export default function ProviderSessionActions({
    connectLabel = 'Connect',
    disconnectLabel = 'Disconnect',
    connected,
    connectEnabled,
    busy,
    status,
    onConnect,
    onDisconnect
}: ProviderSessionActionsProps) {
    return (
        <div className='ardPage-account'>
            <button type='button' disabled={busy || !connectEnabled} onClick={onConnect}>
                {connectLabel}
            </button>
            <button type='button' className='ardButton ardButton--secondary' disabled={busy || !connected} onClick={onDisconnect}>
                {disconnectLabel}
            </button>
            <div className='ardPage-accountStatus'>{status}</div>
        </div>
    );
}
