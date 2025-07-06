
'use client';

import { useAuth } from '@/context/auth-provider';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader } from '../ui/loader';
import { AppShell } from '../app-shell';
import { DoctorAppShell } from '../doctor/doctor-app-shell';
import { NurseAppShell } from '../nurse/nurse-app-shell';

const PUBLIC_USER_ROUTES = ['/auth', '/landing'];
const PUBLIC_DOCTOR_ROUTES = ['/doctor/auth'];
const PUBLIC_NURSE_ROUTES = ['/nurse/auth'];

const ALL_PUBLIC_ROUTES = [...PUBLIC_USER_ROUTES, ...PUBLIC_DOCTOR_ROUTES, ...PUBLIC_NURSE_ROUTES];

export function AuthGuard({ children }: { children: React.ReactNode }) {
    const { user, loading: authLoading } = useAuth();
    const pathname = usePathname();
    const router = useRouter();

    const isDoctorRoute = pathname.startsWith('/doctor/');
    const isNurseRoute = pathname.startsWith('/nurse/');
    const isPublicRoute = ALL_PUBLIC_ROUTES.some(route => pathname === route);

    useEffect(() => {
        if (authLoading) return;

        // User is not logged in
        if (!user) {
            // And is trying to access a protected route
            if (!isPublicRoute) {
                if (isDoctorRoute) {
                    router.replace('/doctor/auth');
                } else if (isNurseRoute) {
                    router.replace('/nurse/auth');
                } else {
                    router.replace('/auth');
                }
            }
        // User is logged in
        } else {
            // And is trying to access a public route
            if (isPublicRoute) {
                if (PUBLIC_DOCTOR_ROUTES.includes(pathname)) {
                    router.replace('/doctor/dashboard');
                } else if (PUBLIC_NURSE_ROUTES.includes(pathname)) {
                    router.replace('/nurse/dashboard');
                } else {
                    router.replace('/');
                }
            }
        }
    }, [authLoading, user, isPublicRoute, router, pathname, isDoctorRoute, isNurseRoute]);

    // Render a loader while authentication is in progress or a redirect is imminent
    if (authLoading || (!user && !isPublicRoute) || (user && isPublicRoute)) {
        return <Loader />;
    }
    
    // If authenticated, render content with the appropriate shell
    if (user) {
        if (isDoctorRoute) {
            return <DoctorAppShell>{children}</DoctorAppShell>;
        }
        if (isNurseRoute) {
            return <NurseAppShell>{children}</NurseAppShell>;
        }
        return <AppShell>{children}</AppShell>;
    }

    // Render public pages without any shell
    return <>{children}</>;
}
