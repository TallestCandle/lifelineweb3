
"use client";

import React from 'react';
import Link from 'next/link';
import {
  HeartPulse,
  FileText,
  Salad,
  ClipboardCheck,
  Camera,
  BrainCircuit,
  Building2,
  Siren,
  LucideIcon
} from "lucide-react";
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/auth-provider';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from '../ui/button';
import { ArrowRight } from 'lucide-react';

interface FeatureCardProps {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
  color: string;
  tag?: string;
}

const mainFeatures: FeatureCardProps[] = [
  {
    href: "/log",
    icon: Camera,
    title: "AI Logger",
    description: "Scan devices & test strips to log vital health data instantly.",
    color: "text-blue-400",
    tag: "Start Here"
  },
  {
    href: "/clinic",
    icon: Building2,
    title: "24/7 Health Clinic",
    description: "Start a case, get a plan from a doctor, and manage your health journey.",
    color: "text-teal-400",
    tag: "Core Feature"
  },
  {
    href: "/deep-dive",
    icon: BrainCircuit,
    title: "Deep Dive Analysis",
    description: "Let our AI analyze your historical data to find hidden trends and insights.",
    color: "text-purple-400",
  },
  {
    href: "/dietician",
    icon: Salad,
    title: "AI Dietician",
    description: "Receive personalized dietary advice based on your health profile.",
    color: "text-green-400",
  },
];

const FeatureCard: React.FC<FeatureCardProps> = ({ href, icon: Icon, title, description, color, tag }) => (
  <Link href={href} className="group block">
    <Card className="h-full transition-all duration-300 hover:border-primary/80 hover:-translate-y-1 hover:shadow-2xl hover:shadow-primary/10 bg-card/50 hover:bg-card">
       <CardContent className="p-6 flex flex-col justify-between h-full">
         <div>
            <div className='flex justify-between items-start'>
                <div className={cn("w-12 h-12 mb-4 rounded-lg flex items-center justify-center bg-primary/10", color)}>
                    <Icon className="w-6 h-6" />
                </div>
                {tag && <div className="text-xs font-bold text-primary uppercase tracking-wider">{tag}</div>}
            </div>
            <CardTitle className="text-lg font-bold mb-1">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
         </div>
         <div className="mt-4 flex items-center text-sm font-semibold text-primary/80 group-hover:text-primary transition-colors">
            Go to {title} <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
         </div>
      </CardContent>
    </Card>
  </Link>
);


export function Dashboard() {
  const { user } = useAuth();
  const firstName = user?.displayName?.split(' ')[0] || 'User';

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="space-y-2">
        <h1 className="text-4xl md:text-5xl font-bold text-foreground">
          Welcome, {firstName}
        </h1>
        <p className="text-lg text-muted-foreground">Your health is your greatest asset. Let's manage it wisely.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {mainFeatures.map((feature) => (
            <FeatureCard key={feature.href} {...feature} />
        ))}
      </div>
      
       <Card className="bg-secondary">
        <CardHeader className="flex-row items-center justify-between">
            <div>
                <CardTitle className="flex items-center gap-2"><Siren className="text-red-500" /> Emergency Services</CardTitle>
                <CardDescription>For critical situations, alert your guardians instantly.</CardDescription>
            </div>
            <Button variant="destructive" asChild>
                <Link href="/emergency">Access Emergency Page</Link>
            </Button>
        </CardHeader>
      </Card>

    </div>
  );
}
