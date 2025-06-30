
"use client";

import { useAuth } from '@/context/auth-provider';
import { usePathname, useRouter } from 'next/navigation';
import { Loader } from '../ui/loader';
import { AppShell } from '../app-shell';
import { ProfileProvider } from '@/context/profile-provider';

const PUBLIC_ROUTES = ['/auth', '/landing'];
const PROTECTED_ROOT = '/';

export function AuthGuard({ children }: { children: React.ReactNode }) {
    const { user, loading: authLoading } = useAuth();
    const pathname = usePathname();
    const router = useRouter();

    if (authLoading) {
        return <Loader />;
    }

    const isPublicRoute = PUBLIC_ROUTES.includes(pathname);

    // If user is not logged in, handle public/protected routes
    if (!user) {
        if (isPublicRoute) {
            return <>{children}</>; // Allow access to public routes
        }
        // For any other route, redirect to auth
        router.replace('/auth');
        return <Loader />;
    }

    // If user is logged in
    if (isPublicRoute) {
        // Redirect from public routes to the app's root
        router.replace(PROTECTED_ROOT);
        return <Loader />;
    }
    
    // If the user is authenticated and on a protected route,
    // wrap the content with the necessary providers and app shell.
    // The ProfileProvider will handle logic related to profile existence.
    return (
        <ProfileProvider>
            <AppShell>
                {children}
            </AppShell>
        </ProfileProvider>
    );
}
