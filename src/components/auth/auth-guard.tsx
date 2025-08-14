
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
const ALWAYS_ACCESSIBLE_ROUTES = ['/blog']; 

const ALL_PUBLIC_ROUTES = [...PUBLIC_USER_ROUTES, ...PUBLIC_DOCTOR_ROUTES, ...PUBLIC_ADMIN_ROUTES];

export function AuthGuard({ children }: { children: React.ReactNode }) {
    const { user, role, loading: authLoading } = useAuth();
    const pathname = usePathname();
    const router = useRouter();

    const isDoctorRoute = pathname.startsWith('/doctor/');
    const isAdminRoute = pathname.startsWith('/admin/');
    const isPublicAuthRoute = ALL_PUBLIC_ROUTES.some(route => pathname === route);
    const isAlwaysAccessible = ALWAYS_ACCESSIBLE_ROUTES.some(prefix => pathname.startsWith(prefix));

    useEffect(() => {
        if (authLoading) {
            // While authentication state is loading, don't do any redirects.
            // The Loader component will be shown.
            return;
        }

        if (isAlwaysAccessible) {
            // Always allow access to routes like the blog.
            return;
        }

        if (!user) {
            // If user is not logged in, they must be on a public auth page.
            // If not, redirect them to the appropriate login page.
            if (!isPublicAuthRoute) {
                if (isDoctorRoute) {
                    router.replace('/doctor/auth');
                } else if (isAdminRoute) {
                    router.replace('/admin/auth');
                } else {
                    router.replace('/landing');
                }
            }
        } else {
            // User is logged in.
            if (role) {
                // Once the role is loaded, enforce role-based routing.
                if (isAdminRoute && role !== 'admin') {
                    router.replace('/'); // Admins only in /admin/*
                } else if (isDoctorRoute && role !== 'doctor') {
                    router.replace('/'); // Doctors only in /doctor/*
                } else if (!isDoctorRoute && !isAdminRoute && (role === 'doctor' || role === 'admin')) {
                    // If a doctor/admin is on a patient page, redirect to their dashboard.
                    router.replace(role === 'doctor' ? '/doctor/dashboard' : '/admin/dashboard');
                }
            }
            
            // If an authenticated user (with a role) is on a public auth page,
            // redirect them away to their correct dashboard.
            if (isPublicAuthRoute && role) {
                 if (role === 'admin') {
                    router.replace('/admin/dashboard');
                } else if (role === 'doctor') {
                     router.replace('/doctor/dashboard');
                } else {
                    router.replace('/'); // Default for patients
                }
            }
        }
    }, [authLoading, user, role, isPublicAuthRoute, isAlwaysAccessible, router, pathname, isDoctorRoute, isAdminRoute]);

    // Show a loader during critical state transitions to prevent content flashing.
    if (authLoading || (!isAlwaysAccessible && !user && !isPublicAuthRoute) || (!isAlwaysAccessible && user && !role) || (!isAlwaysAccessible && user && role && isPublicAuthRoute)) {
        return <Loader />;
    }
    
    // Always render public pages like the blog without any app shell.
    if (isAlwaysAccessible) {
        return <>{children}</>;
    }

    // Determine the correct shell for authenticated users on private routes.
    if (user && role) {
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
    
    // For public auth pages that don't need a shell (login/signup).
    return <>{children}</>;
}
