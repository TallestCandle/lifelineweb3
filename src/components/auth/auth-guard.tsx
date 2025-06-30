'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/context/auth-provider';
import { Loader } from '@/components/ui/loader';
import { AppShell } from '@/components/app-shell';
import { ProfileProvider } from '@/context/profile-provider';

const publicPaths = ['/auth', '/landing'];
const noShellPaths = ['/call'];

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const isPublicPath = publicPaths.some(path => pathname.startsWith(path));
  const isNoShellPath = noShellPaths.some(path => pathname.startsWith(path));

  useEffect(() => {
    if (loading) return;

    // If user is not logged in and trying to access a protected page
    if (!user && !isPublicPath) {
      router.replace('/auth');
    }
    
    // If user is logged in and trying to access a public page (like login)
    if (user && isPublicPath) {
      router.replace('/');
    }

  }, [user, loading, router, pathname, isPublicPath]);

  if (loading) {
    return <Loader />;
  }

  // Unauthenticated user on a public path
  if (!user && isPublicPath) {
    return <>{children}</>;
  }

  // Authenticated user
  if (user) {
    if (isNoShellPath) {
        return <>{children}</>;
    }
    // All logged-in users get the main app shell.
    return (
      <ProfileProvider>
        <AppShell>{children}</AppShell>
      </ProfileProvider>
    );
  }

  // Fallback, typically for unauthenticated users on protected paths before redirect
  return <Loader />;
}
