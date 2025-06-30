
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

    // If user is not logged in
    if (!user) {
        // If they are on the root path, send them to the public landing page.
        if (pathname === PROTECTED_ROOT) {
            router.replace('/landing');
            return <Loader />;
        }
        // If they are trying to access a protected route, send them to auth.
        if (!isPublicRoute) {
            router.replace('/auth');
            return <Loader />;
        }
        // Otherwise, they are on a public route, so let them through.
        return <>{children}</>;
    }

    // If user is logged in
    // If they are on a public page (e.g., trying to visit /auth again), redirect them to the dashboard.
    if (isPublicRoute) {
        router.replace(PROTECTED_ROOT);
        return <Loader />;
    }
    
    // For all other cases (logged in and on a protected route including '/'), wrap with providers and shell.
    // This is the main path for authenticated users.
    return (
        <ProfileProvider>
            <AppShell>
                {children}
            </AppShell>
        </ProfileProvider>
    );
}
