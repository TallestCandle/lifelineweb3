
"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/auth-provider';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { format, parseISO } from 'date-fns';
import {
  HeartPulse,
  Droplet,
  Building2,
  ArrowRight,
  ClipboardList,
  Wind,
  ShieldCheck,
  ShieldAlert,
  ShieldQuestion,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { Badge } from '../ui/badge';
import { cn } from '@/lib/utils';
import { Separator } from '../ui/separator';

// Types
interface VitalReading {
  systolic?: string;
  diastolic?: string;
  bloodSugar?: string;
  oxygenSaturation?: string;
  temperature?: string;
  weight?: string;
  pulseRate?: string;
  date: string;
  otherData?: { metricName: string; metricValue: string }[];
}

interface Investigation {
  id: string;
  status: 'pending_review' | 'awaiting_lab_results' | 'pending_final_review' | 'completed' | 'rejected' | 'awaiting_follow_up_visit';
  createdAt: string;
}

const statusConfig: Record<Investigation['status'], { text: string; color: string; }> = {
  pending_review: { text: 'Awaiting Doctor Review', color: 'bg-yellow-500' },
  awaiting_lab_results: { text: 'Awaiting Lab Results', color: 'bg-blue-500' },
  pending_final_review: { text: 'Doctor Reviewing Results', color: 'bg-yellow-500' },
  completed: { text: 'Case Complete', color: 'bg-green-500' },
  rejected: { text: 'Case Closed', color: 'bg-red-500' },
  awaiting_follow_up_visit: { text: 'Follow-up Visit Pending', color: 'bg-cyan-500' },
};

// --- Helper function to analyze a vital reading ---
function getVitalStatus(vital: VitalReading): {
    level: 'Good' | 'Moderate' | 'Critical';
    message: string;
    icon: React.ElementType;
    color: string;
} {
    if (vital.systolic && vital.diastolic) {
        const sys = parseInt(vital.systolic, 10);
        const dia = parseInt(vital.diastolic, 10);
        if (sys > 180 || dia > 120) return { level: 'Critical', message: 'Hypertensive Crisis. Seek immediate medical attention.', icon: ShieldAlert, color: 'bg-red-600' };
        if (sys >= 140 || dia >= 90) return { level: 'Critical', message: 'High Blood Pressure (Stage 2).', icon: ShieldAlert, color: 'bg-red-600' };
        if (sys >= 130 || dia >= 80) return { level: 'Moderate', message: 'High Blood Pressure (Stage 1).', icon: ShieldQuestion, color: 'bg-orange-500' };
        if (sys > 120) return { level: 'Moderate', message: 'Elevated Blood Pressure.', icon: ShieldQuestion, color: 'bg-yellow-500' };
        if (sys >= 90 && dia >= 60) return { level: 'Good', message: 'Normal Blood Pressure.', icon: ShieldCheck, color: 'bg-green-500' };
        return { level: 'Moderate', message: 'Low Blood Pressure.', icon: ShieldQuestion, color: 'bg-blue-500' };
    }
    if (vital.bloodSugar) {
        const sugar = parseInt(vital.bloodSugar, 10);
        if (sugar > 250) return { level: 'Critical', message: 'Very High Blood Sugar. Seek medical advice.', icon: ShieldAlert, color: 'bg-red-600' };
        if (sugar > 180) return { level: 'Moderate', message: 'High Blood Sugar.', icon: ShieldQuestion, color: 'bg-orange-500' };
        if (sugar >= 70) return { level: 'Good', message: 'Normal Blood Sugar.', icon: ShieldCheck, color: 'bg-green-500' };
        return { level: 'Moderate', message: 'Low Blood Sugar.', icon: ShieldQuestion, color: 'bg-blue-500' };
    }
    if (vital.oxygenSaturation) {
        const oxygen = parseInt(vital.oxygenSaturation, 10);
        if (oxygen < 90) return { level: 'Critical', message: 'Very Low Oxygen. Seek medical attention.', icon: ShieldAlert, color: 'bg-red-600' };
        if (oxygen < 95) return { level: 'Moderate', message: 'Low Oxygen Level.', icon: ShieldQuestion, color: 'bg-orange-500' };
        return { level: 'Good', message: 'Normal Oxygen Level.', icon: ShieldCheck, color: 'bg-green-500' };
    }
    return { level: 'Good', message: 'Data logged.', icon: ShieldCheck, color: 'bg-gray-500' };
}

function VitalStatusCard({ vital }: { vital: VitalReading }) {
    const status = getVitalStatus(vital);
    const StatusIcon = status.icon;

    const renderVitalData = () => {
        const standardVitals = Object.entries(vital)
            .filter(([key]) => key !== 'date' && key !== 'otherData' && vital[key as keyof VitalReading])
            .map(([key, value]) => (
                <div key={key} className="flex justify-between text-sm">
                    <span className="text-muted-foreground capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                    <span className="font-bold">{String(value)}</span>
                </div>
            ));
        
        const otherVitals = vital.otherData?.map((item, index) => (
             <div key={`other-${index}`} className="flex justify-between text-sm">
                <span className="text-muted-foreground capitalize">{item.metricName}</span>
                <span className="font-bold">{item.metricValue}</span>
            </div>
        ));

        return (
            <>
                {standardVitals}
                {otherVitals && standardVitals.length > 0 && <Separator className="my-2" />}
                {otherVitals}
            </>
        );
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center justify-between">
                    <span>Latest Vital Reading</span>
                     <Badge className={cn("text-white", status.color)}>
                        <StatusIcon className="mr-1 h-3 w-3" />
                        {status.level}
                    </Badge>
                </CardTitle>
                <CardDescription>
                    {format(parseISO(vital.date), 'MMM d, yyyy, h:mm a')}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-2">
                    {renderVitalData()}
                    <div className="pt-2 text-center text-sm font-semibold" style={{ color: status.color.startsWith('bg-') ? undefined : status.color }}>
                        {status.message}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

export function Dashboard() {
  const { user } = useAuth();
  const [latestVital, setLatestVital] = useState<VitalReading | null>(null);
  const [activeCases, setActiveCases] = useState<Investigation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const firstName = user?.displayName?.split(' ')[0] || 'User';

  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);

    // Fetch latest vital
    const vitalsCollection = collection(db, `users/${user.uid}/vitals`);
    const q = query(vitalsCollection, orderBy("date", "desc"), limit(1));
    const unsubscribeVitals = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        setLatestVital(snapshot.docs[0].data() as VitalReading);
      } else {
        setLatestVital(null);
      }
      setIsLoading(false);
    }, (error) => {
        console.error("Error fetching latest vital:", error);
        setIsLoading(false);
    });

    // Fetch active cases
    const casesQuery = query(collection(db, "investigations"), where("userId", "==", user.uid), where("status", "in", ["pending_review", "awaiting_lab_results", "pending_final_review", "awaiting_follow_up_visit"]));
    const unsubscribeCases = onSnapshot(casesQuery, (snapshot) => {
      setActiveCases(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Investigation)));
    });

    return () => {
      unsubscribeVitals();
      unsubscribeCases();
    };
  }, [user]);

  const hasData = !isLoading && (latestVital || activeCases.length > 0);

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="space-y-2">
        <h1 className="text-3xl md:text-4xl font-bold text-foreground">
          Welcome, {firstName}
        </h1>
        <p className="text-lg text-muted-foreground">Here's your most recent health update.</p>
      </div>
      
      <div className="grid gap-6 md:grid-cols-2">
        {isLoading ? (
            <Skeleton className="h-64 w-full" />
        ) : latestVital ? (
            <VitalStatusCard vital={latestVital} />
        ) : (
             <Card className="bg-primary/5 border-primary/20 text-center py-10 flex flex-col items-center justify-center">
                <CardContent>
                    <h3 className="text-xl font-bold">Log Your First Vital</h3>
                    <p className="text-muted-foreground mt-2 mb-6">Use the AI Logger to log a health metric. Your status will appear here.</p>
                    <Button asChild>
                        <Link href="/log">Log Your First Data <ArrowRight className="ml-2 h-4 w-4" /></Link>
                    </Button>
                </CardContent>
            </Card>
        )}

        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Building2 className="text-primary"/> Active Clinic Cases
                </CardTitle>
            </CardHeader>
            <CardContent>
            {isLoading ? (
                <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                </div>
            ) : activeCases.length > 0 ? (
                <div className="space-y-4">
                {activeCases.map(c => {
                    const config = statusConfig[c.status];
                    return (
                    <div key={c.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                        <div>
                        <p className="font-bold">Case from {format(parseISO(c.createdAt), 'MMM d, yyyy')}</p>
                        <Badge className={cn("mt-1 text-white", config.color)}>{config.text}</Badge>
                        </div>
                        <Button asChild variant="outline" size="sm">
                        <Link href="/clinic">View Case <ArrowRight className="ml-2 h-4 w-4"/></Link>
                        </Button>
                    </div>
                    )
                })}
                </div>
            ) : (
                <div className="text-center py-8">
                <ClipboardList className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-semibold">No Active Cases</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                    Start a new case in the clinic if you have any health concerns.
                </p>
                <Button asChild className="mt-4">
                    <Link href="/clinic">Go to Clinic</Link>
                </Button>
                </div>
            )}
            </CardContent>
        </Card>
      </div>
    </div>
  );
}
