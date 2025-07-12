
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/auth-provider';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot, where, orderBy, limit } from 'firebase/firestore';
import { format, parseISO, isValid } from 'date-fns';
import {
  Building2,
  ArrowRight,
  ClipboardList,
  HeartPulse,
  Droplets,
  Wind,
  Thermometer,
  AlertCircle,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';

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

interface VitalStatus {
  label: string;
  value: string;
  unit: string;
  Icon: React.ComponentType<{ className?: string }>;
  status: 'Good' | 'Moderate' | 'Critical';
}

// --- Configuration ---
const statusConfig: Record<VitalStatus['status'], { text: string, color: string }> = {
  Good: { text: 'Good', color: 'bg-green-500' },
  Moderate: { text: 'Moderate', color: 'bg-yellow-500' },
  Critical: { text: 'Critical', color: 'bg-red-600' },
};

const caseStatusConfig: Record<Investigation['status'], { text: string; color: string }> = {
    pending_review: { text: 'Awaiting Doctor Review', color: 'bg-yellow-500' },
    awaiting_lab_results: { text: 'Awaiting Lab Results', color: 'bg-blue-500' },
    pending_final_review: { text: 'Doctor Reviewing Results', color: 'bg-yellow-500' },
    completed: { text: 'Case Complete', color: 'bg-green-500' },
    rejected: { text: 'Case Closed', color: 'bg-red-500' },
    awaiting_follow_up_visit: { text: 'Follow-up Visit Pending', color: 'bg-cyan-500' },
};

// --- Helper Functions ---
const getVitalStatus = (type: keyof Omit<VitalReading, 'date'>, value1: number, value2?: number): VitalStatus['status'] => {
  switch (type) {
    case 'systolic':
      const systolic = value1;
      const diastolic = value2 ?? 0;
      if (systolic >= 140 || diastolic >= 90) return 'Critical';
      if (systolic >= 130 || diastolic >= 80) return 'Moderate';
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
  const { toast } = useToast();
  const [activeCases, setActiveCases] = useState<Investigation[]>([]);
  const [latestVitals, setLatestVitals] = useState<VitalReading[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const firstName = user?.displayName?.split(' ')[0] || 'User';

  useEffect(() => {
    if (!user?.uid) {
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);

    const vitalsQuery = query(collection(db, `users/${user.uid}/vitals`), orderBy('date', 'desc'), limit(20));
    const unsubscribeVitals = onSnapshot(vitalsQuery, (snapshot) => {
        setLatestVitals(snapshot.docs.map(doc => doc.data() as VitalReading));
        setIsLoading(false);
    }, (error) => {
        console.error('Error fetching vitals:', error);
        toast({ title: 'Error', description: 'Failed to load vital readings.', variant: 'destructive' });
        setIsLoading(false);
    });

    const casesQuery = query(collection(db, "investigations"), where("userId", "==", user.uid), where("status", "in", ["pending_review", "awaiting_lab_results", "pending_final_review", "awaiting_follow_up_visit"]));
    const unsubscribeCases = onSnapshot(casesQuery, (snapshot) => {
      setActiveCases(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Investigation)));
    });

    return () => {
      unsubscribeVitals();
      unsubscribeCases();
    };
  }, [user?.uid, toast]);

  const vitalDisplayData = useMemo<VitalStatus[]>(() => {
    const vitalTypes: (keyof Omit<VitalReading, 'date'>)[] = ['systolic', 'bloodSugar', 'oxygenSaturation', 'temperature'];
    const foundVitals = new Map<keyof Omit<VitalReading, 'date'>, VitalStatus>();

    for (const reading of latestVitals) {
        for (const type of vitalTypes) {
            if (reading[type] && !foundVitals.has(type)) {
                 switch (type) {
                    case 'systolic':
                        if (reading.systolic && reading.diastolic) {
                             foundVitals.set('systolic', {
                                label: 'Blood Pressure', value: `${reading.systolic}/${reading.diastolic}`, unit: 'mmHg', Icon: HeartPulse,
                                status: getVitalStatus('systolic', Number(reading.systolic), Number(reading.diastolic)),
                            });
                        }
                        break;
                    case 'bloodSugar':
                        if (reading.bloodSugar) {
                            foundVitals.set('bloodSugar', {
                                label: 'Blood Sugar', value: reading.bloodSugar, unit: 'mg/dL', Icon: Droplets,
                                status: getVitalStatus('bloodSugar', Number(reading.bloodSugar)),
                            });
                        }
                        break;
                    case 'oxygenSaturation':
                         if (reading.oxygenSaturation) {
                            foundVitals.set('oxygenSaturation', {
                                label: 'Oxygen Saturation', value: reading.oxygenSaturation, unit: '%', Icon: Wind,
                                status: getVitalStatus('oxygenSaturation', Number(reading.oxygenSaturation)),
                            });
                        }
                        break;
                    case 'temperature':
                        if (reading.temperature) {
                            foundVitals.set('temperature', {
                                label: 'Temperature', value: reading.temperature, unit: '°F', Icon: Thermometer,
                                status: getVitalStatus('temperature', Number(reading.temperature)),
                            });
                        }
                        break;
                }
            }
        }
    }

    return Array.from(foundVitals.values());
  }, [latestVitals]);

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="space-y-2">
        <h1 className="text-3xl md:text-4xl font-bold text-foreground">Welcome, {firstName}</h1>
        <p className="text-lg text-muted-foreground">Here is your health summary.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        <Card>
          <CardHeader>
            <CardTitle>Recent Health Snapshot</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : vitalDisplayData.length > 0 ? (
              <div className="space-y-4">
                {vitalDisplayData.map((vital, index) => (
                  <React.Fragment key={vital.label}>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <vital.Icon className="w-6 h-6 text-primary" />
                        <p className="font-bold">{vital.label}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <p className="text-lg font-mono">
                          {vital.value} <span className="text-sm text-muted-foreground">{vital.unit}</span>
                        </p>
                        <Badge className={cn('text-white', statusConfig[vital.status].color)}>
                          {statusConfig[vital.status].text}
                        </Badge>
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
                <p className="mt-1 text-sm">Use the AI Logger to record your health data.</p>
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
              <Building2 className="text-primary" /> Active Clinic Cases
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
              </div>
            ) : activeCases.length > 0 ? (
              <div className="space-y-4">
                {activeCases.map((c) => {
                  const config = caseStatusConfig[c.status];
                  const createdAtDate = parseISO(c.createdAt);
                  const formattedDate = isValid(createdAtDate) ? format(createdAtDate, 'MMM d, yyyy') : 'Invalid Date';
                  return (
                    <div key={c.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                      <div>
                        <p className="font-bold">Case from {formattedDate}</p>
                        <Badge className={cn('mt-1 text-white', config.color)}>{config.text}</Badge>
                      </div>
                      <Button asChild variant="outline" size="sm">
                        <Link href="/clinic">
                          View Case <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  );
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
