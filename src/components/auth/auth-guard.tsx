
'use client';

import { useAuth } from '@/context/auth-provider';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader } from '../ui/loader';
import { AppShell } from '../app-shell';

const PUBLIC_ROUTES = ['/auth', '/landing'];

export function AuthGuard({ children }: { children: React.ReactNode }) {
    const { user, loading: authLoading } = useAuth();
    const pathname = usePathname();
    const router = useRouter();

    const isPublicRoute = PUBLIC_ROUTES.includes(pathname);

    useEffect(() => {
        if (authLoading) return;

        if (!user && !isPublicRoute) {
            router.replace('/auth');
        }

        if (user && isPublicRoute) {
            router.replace('/');
        }
    }, [authLoading, user, isPublicRoute, router, pathname]);

    if (authLoading) {
        return <Loader />;
    }

    if (!user && !isPublicRoute) {
        return <Loader />;
    }
    
    if (user && isPublicRoute) {
        return <Loader />;
    }

    if (user && !isPublicRoute) {
        return (
            <AppShell>
                {children}
            </AppShell>
        );
    }

    return <>{children}</>;
}
