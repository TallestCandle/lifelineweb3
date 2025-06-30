
'use client';

import { useAuth } from '@/context/auth-provider';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader } from '../ui/loader';
import { AppShell } from '../app-shell';
import { ProfileProvider } from '@/context/profile-provider';
import { ProfileGuard } from './profile-guard';

const PUBLIC_ROUTES = ['/auth', '/landing'];

export function AuthGuard({ children }: { children: React.ReactNode }) {
    const { user, loading: authLoading } = useAuth();
    const pathname = usePathname();
    const router = useRouter();

    const isPublicRoute = PUBLIC_ROUTES.includes(pathname);

    useEffect(() => {
        if (authLoading) return; // Wait until authentication status is known

        // Redirect unauthenticated users from protected routes
        if (!user && !isPublicRoute) {
            router.replace('/auth');
        }

        // Redirect authenticated users from public routes
        if (user && isPublicRoute) {
            router.replace('/');
        }
    }, [authLoading, user, isPublicRoute, router]);


    // Determine what to render based on the current state.
    
    // While checking auth status, always show a loader.
    if (authLoading) {
        return <Loader />;
    }

    // If a redirect is imminent, show a loader to prevent flashing content.
    if (!user && !isPublicRoute) {
        return <Loader />; // Waiting for redirect to /auth
    }
    if (user && isPublicRoute) {
        return <Loader />; // Waiting for redirect to /
    }
    
    // If user is authenticated and on a protected route, render the protected app shell.
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
    
    // Otherwise, it's a public route and the user is not logged in, so render the page.
    return <>{children}</>;
}
