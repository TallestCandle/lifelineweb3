
"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthForm } from '@/components/auth/auth-form';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Stethoscope, User } from 'lucide-react';

export function RoleSelection() {
  const [role, setRole] = useState<'patient' | null>(null);
  const router = useRouter();

  const handleDoctorClick = () => {
    router.push('/doctor/auth');
  };

  if (role === 'patient') {
    return <AuthForm onBack={() => setRole(null)} />;
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="absolute inset-0 -z-10 h-full w-full bg-background bg-[radial-gradient(#D4A017_1px,transparent_1px)] [background-size:32px_32px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,#000_60%,transparent_100%)] opacity-20"></div>
      <Card className="w-full max-w-md mx-4 bg-card/80 backdrop-blur-sm border-primary/20 text-center">
        <CardHeader>
          <div className="flex justify-center items-center gap-2 mb-4">
            <Stethoscope className="w-10 h-10 text-primary"/>
            <h1 className="text-3xl font-bold">Lifeline AI</h1>
          </div>
          <CardTitle>Welcome!</CardTitle>
          <CardDescription>Please select your role to continue.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-4">
          <Button variant="outline" className="w-full h-24 flex-col gap-2" onClick={() => setRole('patient')}>
            <User className="w-8 h-8"/>
            I am a Patient
          </Button>
          <Button variant="outline" className="w-full h-24 flex-col gap-2" onClick={handleDoctorClick}>
            <Stethoscope className="w-8 h-8"/>
            I am a Doctor
          </Button>
        </CardContent>
         <CardFooter className="flex flex-col items-center justify-center gap-4">
            <Button variant="link" onClick={() => router.push('/landing')}>
              Back to Landing Page
            </Button>
             <Button variant="link" size="sm" className="text-xs" onClick={() => router.push('/admin/auth')}>
                Admin Portal
            </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
