
'use client';

import { useAuth } from '@/context/auth-provider';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader } from '../ui/loader';
import { AppShell } from '../app-shell';
import { DoctorAppShell } from '../doctor/doctor-app-shell';
import { AdminAppShell } from '../admin/admin-app-shell';
import { ProfileProvider } from '@/context/profile-provider';

const PUBLIC_USER_ROUTES = ['/auth', '/landing'];
const PUBLIC_DOCTOR_ROUTES = ['/doctor/auth'];
const PUBLIC_ADMIN_ROUTES = ['/admin/auth'];
const ALL_PUBLIC_ROUTES = [...PUBLIC_USER_ROUTES, ...PUBLIC_DOCTOR_ROUTES, ...PUBLIC_ADMIN_ROUTES];

export function AuthGuard({ children }: { children: React.ReactNode }) {
    const { user, role, loading: authLoading } = useAuth();
    const pathname = usePathname();
    const router = useRouter();

    const isDoctorRoute = pathname.startsWith('/doctor/');
    const isAdminRoute = pathname.startsWith('/admin/');
    const isPublicRoute = ALL_PUBLIC_ROUTES.some(route => pathname === route);

    useEffect(() => {
        if (authLoading) return;

        // User is not logged in
        if (!user) {
            if (!isPublicRoute) {
                if (isDoctorRoute) {
                    router.replace('/doctor/auth');
                } else if (isAdminRoute) {
                    router.replace('/admin/auth');
                } else {
                    router.replace('/landing');
                }
            }
        // User is logged in
        } else {
            if (role) {
                if (isAdminRoute && role !== 'admin') {
                    router.replace('/');
                } else if (isDoctorRoute && role !== 'doctor') {
                    router.replace('/');
                } else if (!isDoctorRoute && !isAdminRoute && (role === 'doctor' || role === 'admin')) {
                    router.replace(role === 'doctor' ? '/doctor/dashboard' : '/admin/dashboard');
                }
            }
            
            if (isPublicRoute) {
                 if (role === 'admin') {
                    router.replace('/admin/dashboard');
                } else if (role === 'doctor') {
                     router.replace('/doctor/dashboard');
                } else {
                    router.replace('/');
                }
            }
        }
    }, [authLoading, user, role, isPublicRoute, router, pathname, isDoctorRoute, isAdminRoute]);

    if (authLoading || (!user && !isPublicRoute) || (user && isPublicRoute)) {
        return <Loader />;
    }
    
    // Additional loader to prevent content flashing while role check is happening
    if (user && !role) {
        return <Loader />;
    }

    if (user) {
        if (isAdminRoute && role !== 'admin') return <Loader />;
        if (isDoctorRoute && role !== 'doctor') return <Loader />;
        if (!isAdminRoute && !isDoctorRoute && role !== 'patient') return <Loader />;

        if (isAdminRoute) {
            return <AdminAppShell>{children}</AdminAppShell>
        }
        if (isDoctorRoute) {
            return <DoctorAppShell>{children}</DoctorAppShell>;
        }
        return (
            <ProfileProvider>
                <AppShell>
                    {children}
                </AppShell>
            </ProfileProvider>
        );
    }

    return <>{children}</>;
}
