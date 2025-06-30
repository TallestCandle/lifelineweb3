"use client";

import { useAuth } from '@/context/auth-provider';
import { usePathname, useRouter } from 'next/navigation';
import { Loader } from '../ui/loader';
import { AppShell } from '../app-shell';
import { ProfileProvider } from '@/context/profile-provider';

const PUBLIC_ROUTES = ['/auth', '/landing'];

export function AuthGuard({ children }: { children: React.ReactNode }) {
    const { user, loading: authLoading } = useAuth();
    const pathname = usePathname();
    const router = useRouter();

    if (authLoading) {
        return <Loader />;
    }

    const isPublicRoute = PUBLIC_ROUTES.includes(pathname) || pathname === '/';
    const isLangingPageRoute = pathname === '/landing';

    // If trying to access a protected route without being logged in, redirect to auth page
    if (!user && !isPublicRoute) {
        router.replace('/auth');
        return <Loader />;
    }

    // If logged in and trying to access the auth page, redirect to dashboard
    if (user && pathname === '/auth') {
        router.replace('/');
        return <Loader />;
    }
    
    // If logged in, wrap protected pages with the AppShell and providers
    if (user && !isPublicRoute) {
        return (
            <ProfileProvider>
                <AppShell>
                    {children}
                </AppShell>
            </ProfileProvider>
        );
    }
    
    // If not logged in and accessing the root, redirect to landing
    if (!user && pathname === '/') {
        router.replace('/landing');
        return <Loader />;
    }
    
    // Render public pages (like /auth, /landing) or the root page for logged-in users
    return <>{children}</>;
}
