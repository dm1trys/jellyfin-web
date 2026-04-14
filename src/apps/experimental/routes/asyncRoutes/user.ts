import { AsyncRoute } from 'components/router/AsyncRoute';
import { AppType } from 'constants/appType';
import { PROVIDER_ASYNC_USER_ROUTES } from '../../../stable/features/feed/providerRoutes';

export const ASYNC_USER_ROUTES: AsyncRoute[] = [
    ...PROVIDER_ASYNC_USER_ROUTES,
    { path: 'home', type: AppType.Experimental },
    { path: 'homevideos', type: AppType.Experimental },
    { path: 'livetv', type: AppType.Experimental },
    { path: 'movies', type: AppType.Experimental },
    { path: 'music', type: AppType.Experimental },
    { path: 'books', type: AppType.Experimental },
    { path: 'musicvideos', type: AppType.Experimental },
    { path: 'mypreferencesdisplay', page: 'user/display', type: AppType.Experimental },
    { path: 'mypreferencesmenu', page: 'user/settings' },
    { path: 'quickconnect', page: 'quickConnect' },
    { path: 'search' },
    { path: 'tv', page: 'shows', type: AppType.Experimental },
    { path: 'userprofile', page: 'user/userprofile' }
];
