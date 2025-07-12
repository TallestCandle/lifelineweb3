
"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/auth-provider';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, limit, onSnapshot, where } from 'firebase/firestore';
import { format, parseISO } from 'date-fns';
import {
  HeartPulse,
  Droplet,
  Building2,
  ArrowRight,
  ClipboardList,
  Wind,
  Thermometer,
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

// --- Types ---
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
  type?: 'Blood Pressure' | 'Blood Sugar' | 'Oxygen Saturation' | 'Temperature';
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

// --- Helper function to get vital status ---
function getVitalStatus(vital: VitalReading): {
    level: 'Good' | 'Moderate' | 'Critical';
    message: string;
} {
    if (vital.systolic && vital.diastolic) {
        const sys = parseInt(vital.systolic, 10);
        const dia = parseInt(vital.diastolic, 10);
        if (sys > 180 || dia > 120) return { level: 'Critical', message: 'Hypertensive Crisis' };
        if (sys >= 140 || dia >= 90) return { level: 'Critical', message: 'High (Stage 2)' };
        if (sys >= 130 || dia >= 80) return { level: 'Moderate', message: 'High (Stage 1)' };
        if (sys > 120) return { level: 'Moderate', message: 'Elevated' };
        if (sys >= 90 && dia >= 60) return { level: 'Good', message: 'Normal' };
        return { level: 'Moderate', message: 'Low' };
    }
    if (vital.bloodSugar) {
        const sugar = parseInt(vital.bloodSugar, 10);
        if (sugar > 250) return { level: 'Critical', message: 'Very High' };
        if (sugar > 180) return { level: 'Moderate', message: 'High' };
        if (sugar >= 70) return { level: 'Good', message: 'Normal' };
        return { level: 'Moderate', message: 'Low' };
    }
    if (vital.oxygenSaturation) {
        const oxygen = parseInt(vital.oxygenSaturation, 10);
        if (oxygen < 90) return { level: 'Critical', message: 'Very Low' };
        if (oxygen < 95) return { level: 'Moderate', message: 'Low' };
        return { level: 'Good', message: 'Normal' };
    }
    if (vital.temperature) {
        const temp = parseFloat(vital.temperature);
        if (temp > 103) return { level: 'Critical', message: 'High Fever' };
        if (temp > 99.5) return { level: 'Moderate', message: 'Slight Fever' };
        if (temp >= 97) return { level: 'Good', message: 'Normal' };
        return { level: 'Moderate', message: 'Low' };
    }
    return { level: 'Good', message: 'Normal' };
}

const statusBadgeConfig: Record<'Good' | 'Moderate' | 'Critical', { icon: React.ElementType, color: string }> = {
    'Good': { icon: ShieldCheck, color: 'bg-green-500' },
    'Moderate': { icon: ShieldQuestion, color: 'bg-yellow-500' },
    'Critical': { icon: ShieldAlert, color: 'bg-red-600' },
};


const VitalRow = ({ vital, type }: { vital: VitalReading; type: NonNullable<VitalReading['type']> }) => {
    const status = getVitalStatus(vital);
    const badge = statusBadgeConfig[status.level];

    const icons = {
        'Blood Pressure': HeartPulse,
        'Blood Sugar': Droplet,
        'Oxygen Saturation': Wind,
        'Temperature': Thermometer,
    };
    const Icon = icons[type];

    const getValueString = () => {
        switch (type) {
            case 'Blood Pressure': return `${vital.systolic}/${vital.diastolic} mmHg`;
            case 'Blood Sugar': return `${vital.bloodSugar} mg/dL`;
            case 'Oxygen Saturation': return `${vital.oxygenSaturation}%`;
            case 'Temperature': return `${vital.temperature}°F`;
            default: return '';
        }
    };

    return (
        <div className="flex items-start justify-between py-3">
            <div className="flex items-center gap-4">
                <Icon className="w-6 h-6 text-primary flex-shrink-0" />
                <div>
                    <p className="font-bold">{type}</p>
                    <p className="text-sm text-muted-foreground">{getValueString()}</p>
                </div>
            </div>
            <Badge className={cn("text-white text-xs", badge.color)}>
                <badge.icon className="mr-1 h-3 w-3" />
                {status.message}
            </Badge>
        </div>
    );
};

export function Dashboard() {
  const { user } = useAuth();
  const [latestVitals, setLatestVitals] = useState<VitalReading[]>([]);
  const [activeCases, setActiveCases] = useState<Investigation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const firstName = user?.displayName?.split(' ')[0] || 'User';

  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);

    // Fetch latest vitals
    const vitalsCollection = collection(db, `users/${user.uid}/vitals`);
    const q = query(vitalsCollection, orderBy("date", "desc"), limit(20));
    
    const unsubscribeVitals = onSnapshot(q, (snapshot) => {
        const recentReadings = snapshot.docs.map(doc => doc.data() as VitalReading);
        
        const latestVitalsMap = new Map<NonNullable<VitalReading['type']>, VitalReading>();

        for (const reading of recentReadings) {
            if (reading.systolic && reading.diastolic && !latestVitalsMap.has('Blood Pressure')) {
                latestVitalsMap.set('Blood Pressure', { ...reading, type: 'Blood Pressure' });
            }
            if (reading.bloodSugar && !latestVitalsMap.has('Blood Sugar')) {
                latestVitalsMap.set('Blood Sugar', { ...reading, type: 'Blood Sugar' });
            }
            if (reading.oxygenSaturation && !latestVitalsMap.has('Oxygen Saturation')) {
                latestVitalsMap.set('Oxygen Saturation', { ...reading, type: 'Oxygen Saturation' });
            }
            if (reading.temperature && !latestVitalsMap.has('Temperature')) {
                latestVitalsMap.set('Temperature', { ...reading, type: 'Temperature' });
            }
        }
        
        const displayVitals = Array.from(latestVitalsMap.values());
        setLatestVitals(displayVitals);
        setIsLoading(false);
    }, (error) => {
        console.error("Error fetching latest vitals:", error);
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

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="space-y-2">
        <h1 className="text-3xl md:text-4xl font-bold text-foreground">
          Welcome, {firstName}
        </h1>
        <p className="text-lg text-muted-foreground">Here is your most recent health summary.</p>
      </div>
      
      <div className="space-y-6">
        {isLoading ? (
            <Skeleton className="h-64 w-full" />
        ) : latestVitals.length > 0 ? (
            <Card>
                <CardHeader>
                    <CardTitle>Recent Health Snapshot</CardTitle>
                    <CardDescription>A summary of your latest and most important vital signs.</CardDescription>
                </CardHeader>
                <CardContent className="divide-y divide-border">
                    {latestVitals.map((vital, index) => (
                        vital.type ? <VitalRow key={index} vital={vital} type={vital.type} /> : null
                    ))}
                </CardContent>
            </Card>
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
