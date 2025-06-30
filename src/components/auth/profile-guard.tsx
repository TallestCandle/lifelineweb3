
'use client';

import { useEffect } from 'react';
import { useProfile } from '@/context/profile-provider';
import { usePathname, useRouter } from 'next/navigation';
import { Loader } from '../ui/loader';

export function ProfileGuard({ children }: { children: React.ReactNode }) {
    const { profile, loading } = useProfile();
    const router = useRouter();
    const pathname = usePathname();
    
    const isProfilePage = pathname === '/profiles';

    useEffect(() => {
        // This effect handles the redirection logic.
        // It runs when loading is finished.
        if (loading) {
            return; // Don't do anything while loading
        }
        
        // If loading is done, but there's no profile, and we are not on the profile page,
        // then we must redirect the user to create one.
        if (!profile && !isProfilePage) {
            router.replace('/profiles');
        }
        
        // If loading is done, and a profile *does* exist, but we are still on the profile page,
        // it means the user just created/updated their profile, so we send them to the dashboard.
        // This also prevents a logged-in user with a profile from visiting /profiles manually.
        if (profile && isProfilePage) {
            router.replace('/');
        }
    }, [loading, profile, isProfilePage, router]);

    // This section determines what to RENDER.
    
    // If we are still loading the profile, always show the loader.
    if (loading) {
        return <Loader />;
    }

    // If loading is done, but a redirect is needed, show a loader to prevent content flash.
    if (!profile && !isProfilePage) {
        return <Loader />; // Waiting for redirect to /profiles
    }
    if (profile && isProfilePage) {
        return <Loader />; // Waiting for redirect to /
    }

    // If none of the above, the state is correct, so render the actual page content.
    return <>{children}</>;
}
