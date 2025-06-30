
"use client";

import { useAuth } from '@/context/auth-provider';
import { usePathname, useRouter } from 'next/navigation';
import { Loader } from '../ui/loader';
import { AppShell } from '../app-shell';
import { ProfileProvider } from '@/context/profile-provider';
import { useEffect } from 'react';

const PUBLIC_ROUTES = ['/auth', '/landing'];
const PROTECTED_ROOT = '/';

export function AuthGuard({ children }: { children: React.ReactNode }) {
    const { user, loading: authLoading } = useAuth();
    const pathname = usePathname();
    const router = useRouter();

    useEffect(() => {
        // Don't do anything while auth is loading. The component will just show a loader.
        if (authLoading) {
            return;
        }

        const isPublicRoute = PUBLIC_ROUTES.includes(pathname);

        // If user is not logged in, and not on a public route, redirect to auth.
        if (!user && !isPublicRoute) {
            router.replace('/auth');
        }

        // If user is logged in and on a public route, redirect to the app's root.
        if (user && isPublicRoute) {
            router.replace(PROTECTED_ROOT);
        }

    }, [authLoading, user, pathname, router]);

    // While auth is loading, or during the brief moment before the effect runs, show a loader.
    if (authLoading) {
        return <Loader />;
    }
    
    const isPublicRoute = PUBLIC_ROUTES.includes(pathname);

    // If user is logged in, but on a public route, they are about to be redirected. Show a loader.
    if (user && isPublicRoute) {
        return <Loader />;
    }

    // If user is NOT logged in, but on a protected route, they are about to be redirected. Show a loader.
    if (!user && !isPublicRoute) {
        return <Loader />;
    }
    
    // If the user is authenticated and on a protected route, render the app shell and profile provider.
    if (user && !isPublicRoute) {
        return (
            <ProfileProvider>
                <AppShell>
                    {children}
                </AppShell>
            </ProfileProvider>
        );
    }
    
    // Otherwise, it's a public route and no user is logged in. Render the children (e.g., AuthPage, LandingPage).
    return <>{children}</>;
}
