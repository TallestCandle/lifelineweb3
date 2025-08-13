
"use client";

import { DoctorAuthForm } from '@/components/doctor/auth-form';
import { useSettings } from '@/context/settings-provider';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader } from '@/components/ui/loader';
import { ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

function DoctorAuthPageContent() {
  const { settings, loading } = useSettings();

  if (loading) {
    return <Loader />;
  }
  
  if (!settings?.featureFlags?.isDoctorPortalEnabled) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Card className="w-full max-w-md mx-4 text-center">
            <CardHeader>
                <ShieldAlert className="w-12 h-12 mx-auto text-destructive mb-4"/>
                <CardTitle>Doctor Portal Disabled</CardTitle>
                <CardDescription>
                    Access to the doctor portal is currently disabled by the administrator.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Button asChild>
                    <Link href="/landing">Return to Homepage</Link>
                </Button>
            </CardContent>
        </Card>
      </div>
    )
  }

  return <DoctorAuthForm />;
}

export default function DoctorAuthPage() {
  return <DoctorAuthPageContent />;
}
