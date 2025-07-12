
"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/auth-provider';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { format, parseISO } from 'date-fns';
import {
  Building2,
  ArrowRight,
  ClipboardList,
  HeartPulse,
  Droplets,
  Wind,
  Thermometer,
  AlertCircle
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { Badge } from '../ui/badge';
import { cn } from '@/lib/utils';
import { Separator } from '../ui/separator';

// --- Types ---
interface Investigation {
  id: string;
  status: 'pending_review' | 'awaiting_lab_results' | 'pending_final_review' | 'completed' | 'rejected' | 'awaiting_follow_up_visit';
  createdAt: string;
}

interface VitalReading {
    date: string;
    systolic?: string;
    diastolic?: string;
    bloodSugar?: string;
    oxygenSaturation?: string;
    temperature?: string;
}

interface VitalUIProps {
    label: string;
    value: string;
    unit: string;
    Icon: React.ElementType;
    status: 'Good' | 'Moderate' | 'Critical';
}

const statusConfig: Record<Investigation['status'], { text: string; color: string; }> = {
  pending_review: { text: 'Awaiting Doctor Review', color: 'bg-yellow-500' },
  awaiting_lab_results: { text: 'Awaiting Lab Results', color: 'bg-blue-500' },
  pending_final_review: { text: 'Doctor Reviewing Results', color: 'bg-yellow-500' },
  completed: { text: 'Case Complete', color: 'bg-green-500' },
  rejected: { text: 'Case Closed', color: 'bg-red-500' },
  awaiting_follow_up_visit: { text: 'Follow-up Visit Pending', color: 'bg-cyan-500' },
};

const statusBadgeConfig: Record<VitalUIProps['status'], string> = {
    'Good': 'bg-green-500',
    'Moderate': 'bg-yellow-500',
    'Critical': 'bg-red-500',
};


const getVitalStatus = (type: keyof VitalReading, value1: number, value2?: number): VitalUIProps['status'] => {
    switch (type) {
        case 'systolic': // This case covers blood pressure
            const systolic = value1;
            const diastolic = value2 || 0;
            if ((systolic >= 140 || diastolic >= 90)) return 'Critical';
            if ((systolic >= 130 || diastolic >= 80)) return 'Moderate';
            return 'Good';
        case 'bloodSugar':
            if (value1 > 180 || value1 < 70) return 'Critical';
            if (value1 > 140) return 'Moderate';
            return 'Good';
        case 'oxygenSaturation':
            if (value1 < 92) return 'Critical';
            if (value1 < 95) return 'Moderate';
            return 'Good';
        case 'temperature':
            if (value1 > 100.4) return 'Critical';
            if (value1 > 99.5) return 'Moderate';
            return 'Good';
        default:
            return 'Good';
    }
};


export function Dashboard() {
  const { user } = useAuth();
  const [activeCases, setActiveCases] = useState<Investigation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [latestVitals, setLatestVitals] = useState<Partial<Record<keyof VitalReading, VitalReading>>>({});
  const [isVitalsLoading, setIsVitalsLoading] = useState(true);


  const firstName = user?.displayName?.split(' ')[0] || 'User';

  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      setIsVitalsLoading(false);
      return;
    }
    
    setIsLoading(true);
    setIsVitalsLoading(true);

    // --- Fetch Vitals ---
    const vitalsQuery = query(collection(db, `users/${user.uid}/vitals`), orderBy("date", "desc"), limit(20));
    const unsubscribeVitals = onSnapshot(vitalsQuery, (snapshot) => {
        const latestFoundVitals = new Map<keyof VitalReading, VitalReading>();

        snapshot.docs.forEach(doc => {
            const data = doc.data() as VitalReading;
            
            if (data.systolic && data.diastolic && !latestFoundVitals.has('systolic')) {
                latestFoundVitals.set('systolic', data);
            }
            if (data.bloodSugar && !latestFoundVitals.has('bloodSugar')) {
                latestFoundVitals.set('bloodSugar', data);
            }
            if (data.oxygenSaturation && !latestFoundVitals.has('oxygenSaturation')) {
                latestFoundVitals.set('oxygenSaturation', data);
            }
            if (data.temperature && !latestFoundVitals.has('temperature')) {
                latestFoundVitals.set('temperature', data);
            }
        });

        setLatestVitals(Object.fromEntries(latestFoundVitals));
        setIsVitalsLoading(false);
    }, (error) => {
        console.error("Error fetching vitals:", error);
        setIsVitalsLoading(false);
    });

    // --- Fetch Active Cases ---
    const casesQuery = query(collection(db, "investigations"), where("userId", "==", user.uid), where("status", "in", ["pending_review", "awaiting_lab_results", "pending_final_review", "awaiting_follow_up_visit"]));
    const unsubscribeCases = onSnapshot(casesQuery, (snapshot) => {
      setActiveCases(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Investigation)));
      setIsLoading(false); // General loading off
    }, (error) => {
        console.error("Error fetching active cases:", error);
        setIsLoading(false);
    });

    return () => {
      unsubscribeVitals();
      unsubscribeCases();
    };
  }, [user]);

  const vitalDisplayData: VitalUIProps[] = Object.entries(latestVitals).map(([type, data]) => {
      switch(type as keyof VitalReading) {
          case 'systolic':
              return {
                  label: 'Blood Pressure',
                  value: `${data.systolic}/${data.diastolic}`,
                  unit: 'mmHg',
                  Icon: HeartPulse,
                  status: getVitalStatus('systolic', Number(data.systolic), Number(data.diastolic))
              };
          case 'bloodSugar':
              return {
                  label: 'Blood Sugar',
                  value: data.bloodSugar!,
                  unit: 'mg/dL',
                  Icon: Droplets,
                  status: getVitalStatus('bloodSugar', Number(data.bloodSugar))
              };
          case 'oxygenSaturation':
              return {
                  label: 'Oxygen Saturation',
                  value: data.oxygenSaturation!,
                  unit: '%',
                  Icon: Wind,
                  status: getVitalStatus('oxygenSaturation', Number(data.oxygenSaturation))
              };
          case 'temperature':
              return {
                  label: 'Temperature',
                  value: data.temperature!,
                  unit: '°F',
                  Icon: Thermometer,
                  status: getVitalStatus('temperature', Number(data.temperature))
              };
          default:
              return null;
      }
  }).filter((item): item is VitalUIProps => item !== null);

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="space-y-2">
        <h1 className="text-3xl md:text-4xl font-bold text-foreground">
          Welcome, {firstName}
        </h1>
        <p className="text-lg text-muted-foreground">Here is your most recent health summary.</p>
      </div>
      
      <div className="space-y-6">
        <Card>
            <CardHeader>
                <CardTitle>Recent Health Snapshot</CardTitle>
            </CardHeader>
            <CardContent>
                {isVitalsLoading ? (
                    <Skeleton className="h-48 w-full" />
                ) : vitalDisplayData.length > 0 ? (
                    <div className="space-y-4">
                        {vitalDisplayData.map((vital, index) => (
                            <React.Fragment key={vital.label}>
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                        <vital.Icon className="w-6 h-6 text-primary"/>
                                        <p className="font-bold">{vital.label}</p>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <p className="text-lg font-mono">{vital.value} <span className="text-sm text-muted-foreground">{vital.unit}</span></p>
                                        <Badge className={cn("text-white", statusBadgeConfig[vital.status])}>{vital.status}</Badge>
                                    </div>
                                </div>
                                {index < vitalDisplayData.length - 1 && <Separator />}
                            </React.Fragment>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-8 text-muted-foreground">
                        <AlertCircle className="mx-auto h-12 w-12" />
                        <h3 className="mt-4 text-lg font-semibold">No Recent Vitals</h3>
                        <p className="mt-1 text-sm">
                            Use the AI Logger to record your health data.
                        </p>
                        <Button asChild className="mt-4">
                            <Link href="/log">Go to Logger</Link>
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>

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

    