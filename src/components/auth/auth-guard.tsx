'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/context/auth-provider';
import { Loader } from '@/components/ui/loader';
import { AppShell } from '@/components/app-shell';
import { ProfileProvider } from '@/context/profile-provider';

const publicPaths = ['/auth'];
const noShellPaths = ['/call'];

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const isPublicPath = publicPaths.includes(pathname);
  const isNoShellPath = noShellPaths.some(path => pathname.startsWith(path));

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
    return (
      <ProfileProvider>
        {isNoShellPath ? (
          <>{children}</>
        ) : (
          <AppShell>{children}</AppShell>
        )}
      </ProfileProvider>
    );
  }

  return <>{children}</>;
}
