import React from 'react';
import { Navigate } from 'react-router-dom';

import { ARD_PROVIDER } from 'apps/stable/features/ard/provider';

export default function ArdIndex() {
    return <Navigate replace to={ARD_PROVIDER.routes.home} />;
}
