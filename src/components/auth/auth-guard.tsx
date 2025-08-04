
'use client';

import { useAuth } from '@/context/auth-provider';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader } from '../ui/loader';
import { AppShell } from '../app-shell';
import { DoctorAppShell } from '../doctor/doctor-app-shell';
import { AdminAppShell } from '../admin/admin-app-shell';
import { ProfileProvider } from '@/context/profile-provider';
import { SettingsProvider } from '@/context/settings-provider';

const PUBLIC_USER_ROUTES = ['/auth', '/landing'];
const PUBLIC_DOCTOR_ROUTES = ['/doctor/auth'];
const PUBLIC_ADMIN_ROUTES = ['/admin/auth'];
// Blog routes are accessible to everyone, logged in or not.
const ALWAYS_ACCESSIBLE_ROUTES = ['/blog']; 

const ALL_PUBLIC_ROUTES = [...PUBLIC_USER_ROUTES, ...PUBLIC_DOCTOR_ROUTES, ...PUBLIC_ADMIN_ROUTES];

export function AuthGuard({ children }: { children: React.ReactNode }) {
    const { user, role, loading: authLoading } = useAuth();
    const pathname = usePathname();
    const router = useRouter();

    const isDoctorRoute = pathname.startsWith('/doctor/');
    const isAdminRoute = pathname.startsWith('/admin/');
    // A route is considered "public" if it's in the main auth lists.
    const isPublicAuthRoute = ALL_PUBLIC_ROUTES.some(route => pathname === route);
    // A route is "always accessible" if it's a content page like the blog.
    const isAlwaysAccessible = ALWAYS_ACCESSIBLE_ROUTES.some(prefix => pathname.startsWith(prefix));

    useEffect(() => {
        if (authLoading) return;

        // If the route is always accessible (like the blog), don't apply any redirect logic.
        if (isAlwaysAccessible) return;

        // User is not logged in
        if (!user) {
            if (!isPublicAuthRoute) {
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
            
            if (isPublicAuthRoute) {
                 if (role === 'admin') {
                    router.replace('/admin/dashboard');
                } else if (role === 'doctor') {
                     router.replace('/doctor/dashboard');
                } else {
                    router.replace('/');
                }
            }
        }
    }, [authLoading, user, role, isPublicAuthRoute, isAlwaysAccessible, router, pathname, isDoctorRoute, isAdminRoute]);

    if (authLoading || (!isAlwaysAccessible && !user && !isPublicAuthRoute) || (!isAlwaysAccessible && user && isPublicAuthRoute)) {
        return <Loader />;
    }
    
    // Additional loader to prevent content flashing while role check is happening
    if (user && !role && !isAlwaysAccessible) {
        return <Loader />;
    }
    
    // If the route is public (like the blog), render it without any app shell,
    // regardless of whether the user is logged in or not.
    if (isAlwaysAccessible) {
        return <>{children}</>;
    }

    // Determine the correct shell for the user
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
          <SettingsProvider>
            <ProfileProvider>
                <AppShell>
                    {children}
                </AppShell>
            </ProfileProvider>
          </SettingsProvider>
        );
    }
    
    // For completely public auth pages (login/signup) that don't need a shell
    return <>{children}</>;
}
