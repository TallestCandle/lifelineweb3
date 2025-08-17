
'use client';

import { useAuth } from '@/context/auth-provider';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader } from '../ui/loader';
import { AppShell } from '../app-shell';
import { ProfileProvider } from '@/context/profile-provider';
import { SettingsProvider } from '@/context/settings-provider';

const PUBLIC_ROUTES = ['/auth', '/landing'];
const ALWAYS_ACCESSIBLE_ROUTES = ['/blog']; 

export function AuthGuard({ children }: { children: React.ReactNode }) {
    const { user, loading: authLoading } = useAuth();
    const pathname = usePathname();
    const router = useRouter();

    const isPublicRoute = PUBLIC_ROUTES.includes(pathname);
    const isAlwaysAccessible = ALWAYS_ACCESSIBLE_ROUTES.some(prefix => pathname.startsWith(prefix));

    useEffect(() => {
        if (authLoading) {
            return;
        }

        if (isAlwaysAccessible) {
            return;
        }

        if (!user) {
            // If user is not logged in, and not on a public route, redirect to auth.
            if (!isPublicRoute) {
                router.replace('/auth');
            }
        } else {
            // If user is logged in and on a public auth page, redirect to dashboard.
            if (isPublicRoute) {
                router.replace('/');
            }
        }
    }, [authLoading, user, isPublicRoute, isAlwaysAccessible, router, pathname]);

    // Show a loader during critical state transitions to prevent content flashing.
    if (authLoading || (!isAlwaysAccessible && !user && !isPublicRoute) || (!isAlwaysAccessible && user && isPublicRoute)) {
        return <Loader />;
    }
    
    if (isAlwaysAccessible) {
        return <>{children}</>;
    }

    if (user) {
        return (
          <SettingsProvider>
            <ProfileProvider>
                <AppShell>
                    {children}
                </AppShell>
            </ProfileProvider>
          </SettingsProvider>
        );
    }
    
    // For public auth pages that don't need a shell (login/signup).
    return <>{children}</>;
}
