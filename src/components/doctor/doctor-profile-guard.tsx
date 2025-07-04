
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
            return;
        }
        
        if (!profile && !isProfilePage) {
            router.replace('/doctor/profile');
        }
        
        if (profile && isProfilePage) {
            router.replace('/doctor/dashboard');
        }
    }, [loading, profile, isProfilePage, router]);
    
    if (loading) {
        return <Loader />;
    }

    if (!profile && !isProfilePage) {
        return <Loader />;
    }
    if (profile && isProfilePage) {
        return <Loader />;
    }

    return <>{children}</>;
}
