
"use client";

import React from 'react';
import Link from 'next/link';
import {
  HeartPulse,
  FileText,
  Salad,
  ClipboardCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/auth-provider';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

interface DashboardCardProps {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
  color: string;
}

const mainFeatures: DashboardCardProps[] = [
  {
    href: "/log",
    icon: HeartPulse,
    title: "AI Logger",
    description: "Scan devices & test strips to log data.",
    color: "text-red-400",
  },
  {
    href: "/dietician",
    icon: Salad,
    title: "AI Dietician",
    description: "Personalized meal plans for you.",
    color: "text-green-400",
  },
  {
    href: "/report",
    icon: FileText,
    title: "Monthly Report",
    description: "Review your detailed health summary.",
    color: "text-purple-400",
  },
  {
    href: "/deep-dive",
    icon: ClipboardCheck,
    title: "Deep Dive",
    description: "AI analysis of your health trends.",
    color: "text-sky-400",
  },
];

const DashboardCard: React.FC<DashboardCardProps> = ({ href, icon: Icon, title, description, color }) => (
  <Link href={href} className="group block">
    <Card className="h-full transition-all duration-300 hover:border-primary/50 hover:-translate-y-1 hover:shadow-2xl hover:shadow-primary/10">
      <CardHeader>
        <Icon className={cn("w-8 h-8 mb-2", color)} />
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
    </Card>
  </Link>
);


export function Dashboard() {
  const { user } = useAuth();
  const firstName = user?.displayName?.split(' ')[0] || 'User';

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl md:text-4xl font-bold text-foreground/90">
          Welcome back, {firstName}.
        </h1>
        <p className="text-lg text-muted-foreground">Let's check on your health today.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>Your Quick Actions</CardTitle>
              <CardDescription>Key tools for your health journey.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {mainFeatures.map((feature) => (
                    <DashboardCard key={feature.href} {...feature} />
                ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
