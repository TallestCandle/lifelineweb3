
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
        
        // If loading is done, but there's no complete profile (age is a good indicator),
        // and we are not on the profile page, then we must redirect the user to create one.
        if (profile && !profile.age && !isProfilePage) {
            router.replace('/profiles');
        }
        
    }, [loading, profile, isProfilePage, router]);

    // This section determines what to RENDER.
    
    // If we are still loading the profile, always show the loader.
    if (loading) {
        return <Loader />;
    }

    // If loading is done, but a redirect is needed, show a loader to prevent content flash.
    if (profile && !profile.age && !isProfilePage) {
        return <Loader />; // Waiting for redirect to /profiles
    }

    // If none of the above, the state is correct, so render the actual page content.
    return <>{children}</>;
}
