
"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthForm } from '@/components/auth/auth-form';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Stethoscope, User, Bot } from 'lucide-react';

export function RoleSelection() {
  const router = useRouter();

  // This component now directly renders the AuthForm for patients.
  // The role selection logic is removed.
  return <AuthForm onBack={() => router.push('/landing')} />;
}
