'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/context/auth-provider';
import { Loader } from '@/components/ui/loader';
import { AppShell } from '@/components/app-shell';
import { ProfileProvider } from '@/context/profile-provider';

const publicPaths = ['/auth'];

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const isPublicPath = publicPaths.includes(pathname);

  useEffect(() => {
    if (!loading) {
      if (!user && !isPublicPath) {
        router.push('/auth');
      } else if (user && isPublicPath) {
        router.push('/');
      }
    }
  }, [user, loading, router, pathname, isPublicPath]);

  if (loading || (!user && !isPublicPath) || (user && isPublicPath)) {
    return <Loader />;
  }

  if (user) {
    // Wrap AppShell with ProfileProvider
    return (
      <ProfileProvider>
        <AppShell>{children}</AppShell>
      </ProfileProvider>
    );
  }

  return <>{children}</>;
}
