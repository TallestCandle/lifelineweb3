"use client";

import { AuthForm } from '@/components/auth/auth-form';
import { useRouter } from 'next/navigation';

export default function AuthPage() {
  const router = useRouter();
  
  // The onBack function is no longer needed as role selection is removed.
  // We can simulate a "back" navigation for a better user experience if needed,
  // for example, by redirecting to the landing page.
  const handleBack = () => {
    router.push('/landing');
  };

  return <AuthForm onBack={handleBack} />;
}
