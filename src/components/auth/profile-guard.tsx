
'use client';

import { useEffect } from 'react';
import { useProfile } from '@/context/profile-provider';
import { usePathname, useRouter } from 'next/navigation';
import { Loader } from '../ui/loader';

export function ProfileGuard({ children }: { children: React.ReactNode }) {
    const { profile, loading } = useProfile();
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        // If data has loaded, there is no profile, and we are NOT on the profile setup page, redirect.
        if (!loading && !profile && pathname !== '/profiles') {
            router.replace('/profiles');
        }
    }, [loading, profile, pathname, router]);

    if (loading) {
        return <Loader />;
    }

    // If we are about to redirect, show a loader to prevent the child page from flashing.
    if (!profile && pathname !== '/profiles') {
        return <Loader />;
    }

    // Render the children (AppShell, etc.)
    return <>{children}</>;
}
