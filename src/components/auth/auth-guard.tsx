
'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/context/auth-provider';
import { Loader } from '@/components/ui/loader';
import { AppShell } from '@/components/app-shell';
import { DoctorAppShell } from '@/components/doctor/doctor-app-shell';
import { ProfileProvider } from '@/context/profile-provider';

const publicPaths = ['/auth', '/landing'];
const noShellPaths = ['/call'];
const doctorPaths = ['/doctor'];

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, userData, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const isPublicPath = publicPaths.includes(pathname);
  const isNoShellPath = noShellPaths.some(path => pathname.startsWith(path));
  const isDoctorPath = doctorPaths.some(path => pathname.startsWith(path));

  useEffect(() => {
    if (!loading) {
      if (!user && !isPublicPath) {
        router.replace('/landing');
      } else if (user && userData) {
        // User is logged in, handle routing based on role
        if (isPublicPath) {
            router.replace(userData.role === 'doctor' ? '/doctor/dashboard' : '/');
        } else if (isDoctorPath && userData.role !== 'doctor') {
            router.replace('/'); // Patient trying to access doctor routes
        } else if (!isDoctorPath && userData.role === 'doctor') {
            router.replace('/doctor/dashboard'); // Doctor trying to access patient routes
        }
      }
    }
  }, [user, userData, loading, router, pathname, isPublicPath, isDoctorPath]);

  if (loading) {
    return <Loader />;
  }

  // Handle unauthenticated users
  if (!user) {
    if (isPublicPath) {
      return <>{children}</>;
    }
    return <Loader />; // Or redirect immediately, but useEffect handles it
  }

  // Handle authenticated users
  if (userData) {
    if (isNoShellPath) {
      return <>{children}</>;
    }

    if (userData.role === 'doctor') {
      return <DoctorAppShell>{children}</DoctorAppShell>;
    }
    
    if (userData.role === 'patient') {
      return (
        <ProfileProvider>
          <AppShell>{children}</AppShell>
        </ProfileProvider>
      );
    }
  }

  // Fallback for user logged in but userData is not yet available or role is unknown
  return <Loader />;
}
