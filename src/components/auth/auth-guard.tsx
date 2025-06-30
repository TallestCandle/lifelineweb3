
"use client";

import { useAuth } from '@/context/auth-provider';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader } from '../ui/loader';
import { AppShell } from '../app-shell';
import { ProfileProvider } from '@/context/profile-provider';
import { ProfileGuard } from './profile-guard';

const PUBLIC_ROUTES = ['/auth', '/landing'];
const PROTECTED_ROOT = '/';

export function AuthGuard({ children }: { children: React.ReactNode }) {
    const { user, loading: authLoading } = useAuth();
    const pathname = usePathname();
    const router = useRouter();

    useEffect(() => {
        if (authLoading) return;

        const isPublicRoute = PUBLIC_ROUTES.includes(pathname);

        if (!user && !isPublicRoute) {
            router.replace('/auth');
        }

        if (user && isPublicRoute) {
            router.replace(PROTECTED_ROOT);
        }

    }, [authLoading, user, pathname, router]);

    if (authLoading) {
        return <Loader />;
    }
    
    const isPublicRoute = PUBLIC_ROUTES.includes(pathname);

    if ((user && isPublicRoute) || (!user && !isPublicRoute)) {
        return <Loader />;
    }
    
    if (user && !isPublicRoute) {
        return (
            <ProfileProvider>
                <ProfileGuard>
                    <AppShell>
                        {children}
                    </AppShell>
                </ProfileGuard>
            </ProfileProvider>
        );
    }
    
    return <>{children}</>;
}
