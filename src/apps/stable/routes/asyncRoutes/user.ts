import { AsyncRoute } from '../../../../components/router/AsyncRoute';

export const ASYNC_USER_ROUTES: AsyncRoute[] = [
    { path: 'ardhome', page: 'ard/home' },
    { path: 'ardpage', page: 'ard/page' },
    { path: 'ardsearch', page: 'ard/search' },
    { path: 'arditem/:id', page: 'ard/item' },
    { path: 'mypreferencesmenu', page: 'user/settings' },
    { path: 'quickconnect', page: 'quickConnect' },
    { path: 'search', page: 'search' },
    { path: 'userprofile', page: 'user/userprofile' }
];
