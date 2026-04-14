import { AsyncRoute } from '../../../../components/router/AsyncRoute';
import { PROVIDER_ASYNC_USER_ROUTES } from '../../features/feed/providerRoutes';

export const ASYNC_USER_ROUTES: AsyncRoute[] = [
    ...PROVIDER_ASYNC_USER_ROUTES,
    { path: 'mypreferencesmenu', page: 'user/settings' },
    { path: 'quickconnect', page: 'quickConnect' },
    { path: 'search', page: 'search' },
    { path: 'userprofile', page: 'user/userprofile' }
];
