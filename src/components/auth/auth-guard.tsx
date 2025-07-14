
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
    const { user, role, loading: authLoading } = useAuth();
    const pathname = usePathname();
    const router = useRouter();

    const isDoctorRoute = pathname.startsWith('/doctor/');
    const isPublicRoute = ALL_PUBLIC_ROUTES.some(route => pathname === route);

    useEffect(() => {
        if (authLoading) return;

        // User is not logged in
        if (!user) {
            if (!isPublicRoute) {
                if (isDoctorRoute) {
                    router.replace('/doctor/auth');
                } else {
                    router.replace('/landing');
                }
            }
        // User is logged in
        } else {
            // User has a role and is on a protected route
            if (role) {
                if (isDoctorRoute && role !== 'doctor') {
                    // Patient trying to access doctor routes
                    router.replace('/');
                } else if (!isDoctorRoute && role !== 'patient') {
                    // Doctor trying to access patient routes
                    router.replace('/doctor/dashboard');
                }
            }
            
            // User is trying to access a public route
            if (isPublicRoute) {
                if (PUBLIC_DOCTOR_ROUTES.includes(pathname)) {
                    router.replace('/doctor/dashboard');
                } else {
                    router.replace('/');
                }
            }
        }
    }, [authLoading, user, role, isPublicRoute, router, pathname, isDoctorRoute]);

    if (authLoading || (!user && !isPublicRoute) || (user && isPublicRoute)) {
        return <Loader />;
    }
    
    // Additional loader to prevent content flashing while role check is happening
    if (user && !role) {
        return <Loader />;
    }
    
    if (user && role === 'doctor' && !isDoctorRoute) {
        return <Loader />; // Doctor on patient route, waiting for redirect
    }
    if (user && role === 'patient' && isDoctorRoute) {
        return <Loader />; // Patient on doctor route, waiting for redirect
    }

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

    return <>{children}</>;
}
