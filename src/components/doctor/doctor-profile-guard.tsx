
'use client';

import { useEffect } from 'react';
import { useDoctorProfile } from '@/context/doctor-profile-provider';
import { usePathname, useRouter } from 'next/navigation';
import { Loader } from '../ui/loader';

export function DoctorProfileGuard({ children }: { children: React.ReactNode }) {
    const { profile, loading } = useDoctorProfile();
    const router = useRouter();
    const pathname = usePathname();
    
    const isProfilePage = pathname === '/doctor/profile';

    useEffect(() => {
        if (loading) {
            return; // Don't do anything while loading.
        }
        
        // This logic remains: if there's no profile, the doctor must create one
        // before accessing other parts of the dashboard.
        if (!profile && !isProfilePage) {
            router.replace('/doctor/profile');
        }
        
        // The problematic block that prevented editing has been removed.
        // Doctors with existing profiles can now access their profile page.
        
    }, [loading, profile, isProfilePage, router]);
    
    if (loading) {
        return <Loader />;
    }

    // If loading is done but a redirect is needed, show a loader to prevent content flash.
    if (!profile && !isProfilePage) {
        return <Loader />;
    }

    // If the state is correct, render the page content.
    return <>{children}</>;
}
