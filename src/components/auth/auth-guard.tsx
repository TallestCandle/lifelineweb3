
'use client';

import { useAuth } from '@/context/auth-provider';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader } from '../ui/loader';
import { AppShell } from '../app-shell';
import { DoctorAppShell } from '../doctor/doctor-app-shell';
import { ProfileGuard } from './profile-guard';
import { ProfileProvider } from '@/context/profile-provider';

const PUBLIC_USER_ROUTES = ['/auth', '/landing'];
const PUBLIC_DOCTOR_ROUTES = ['/doctor/auth'];

const ALL_PUBLIC_ROUTES = [...PUBLIC_USER_ROUTES, ...PUBLIC_DOCTOR_ROUTES];

export function AuthGuard({ children }: { children: React.ReactNode }) {
    const { user, loading: authLoading } = useAuth();
    const pathname = usePathname();
    const router = useRouter();

    const isDoctorRoute = pathname.startsWith('/doctor/');
    const isPublicRoute = ALL_PUBLIC_ROUTES.some(route => pathname === route);

    useEffect(() => {
        if (authLoading) return;

        // User is not logged in
        if (!user) {
            // And is trying to access a protected route
            if (!isPublicRoute) {
                if (isDoctorRoute) {
                    router.replace('/doctor/auth');
                } else {
                    router.replace('/landing');
                }
            }
        // User is logged in
        } else {
            // And is trying to access a public route
            if (isPublicRoute) {
                if (PUBLIC_DOCTOR_ROUTES.includes(pathname)) {
                    router.replace('/doctor/dashboard');
                } else {
                    router.replace('/');
                }
            }
        }
    }, [authLoading, user, isPublicRoute, router, pathname, isDoctorRoute]);

    // Render a loader while authentication is in progress or a redirect is imminent
    if (authLoading || (!user && !isPublicRoute) || (user && isPublicRoute)) {
        return <Loader />;
    }
    
    // If authenticated, render content with the appropriate shell
    if (user) {
        if (isDoctorRoute) {
            return <DoctorAppShell>{children}</DoctorAppShell>;
        }
        return (
            <ProfileProvider>
                <AppShell>
                    <ProfileGuard>
                        {children}
                    </ProfileGuard>
                </AppShell>
            </ProfileProvider>
        );
    }

    // Render public pages without any shell
    return <>{children}</>;
}
