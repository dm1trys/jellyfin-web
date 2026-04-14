import React, { type FC, type PropsWithChildren } from 'react';

import ProviderPageLayout from 'apps/stable/features/feed/components/ProviderPageLayout';
import { ZDF_PROVIDER } from '../provider';
import '../style.scss';

type ZdfPageLayoutProps = PropsWithChildren<{
    id: string
    title: string
    query?: string
}>;

const ZdfPageLayout: FC<ZdfPageLayoutProps> = ({ id, title, query = '', children }) => {
    return (
        <ProviderPageLayout
            id={id}
            title={title}
            query={query}
            searchPlaceholder={ZDF_PROVIDER.searchPlaceholder}
            searchRoute={ZDF_PROVIDER.routes.search}
            navLinks={ZDF_PROVIDER.navLinks}
        >
            {children}
        </ProviderPageLayout>
    );
};

export default ZdfPageLayout;
