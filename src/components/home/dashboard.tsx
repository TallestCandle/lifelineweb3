"use client"

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { HeartPulse, ListChecks, Siren, ShieldCheck, ShieldAlert, ShieldX, Thermometer, Droplets, Activity, Scale } from "lucide-react";
import { format, parseISO, isToday, subDays, formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { HealthTips } from './health-tips';

interface VitalsEntry {
  id: string;
  date: string;
  systolic?: string;
  diastolic?: string;
  oxygenLevel?: string;
  temperature?: string;
  bloodSugar?: string;
  weight?: string;
}

interface Task {
  id: string;
  text: string;
  completed: boolean;
}

interface TriggeredAlert {
  id: string;
  message: string;
  timestamp: string;
}

const VITALS_LOCAL_STORAGE_KEY = 'nexus-lifeline-vitals';
const TASKS_LOCAL_STORAGE_KEY = 'nexus-lifeline-tasks';
const ALERTS_LOCAL_STORAGE_KEY = 'nexus-lifeline-alerts';

export function Dashboard() {
  const [isClient, setIsClient] = useState(false);
  const [latestVitals, setLatestVitals] = useState<VitalsEntry | null>(null);
  const [taskProgress, setTaskProgress] = useState({ completed: 0, total: 0 });
  const [lastAlert, setLastAlert] = useState<TriggeredAlert | null>(null);
  const [weeklyStatus, setWeeklyStatus] = useState<{ status: 'Good' | 'Unstable' | 'Critical'; reason: string } | null>(null);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (isClient) {
      const storedVitalsRaw = window.localStorage.getItem(VITALS_LOCAL_STORAGE_KEY);
      const allVitals: VitalsEntry[] = storedVitalsRaw ? JSON.parse(storedVitalsRaw) : [];

      const storedTasksRaw = window.localStorage.getItem(TASKS_LOCAL_STORAGE_KEY);
      const allTasks: Task[] = storedTasksRaw ? JSON.parse(storedTasksRaw) : [];

      const storedAlertsRaw = window.localStorage.getItem(ALERTS_LOCAL_STORAGE_KEY);
      const allAlerts: TriggeredAlert[] = storedAlertsRaw ? JSON.parse(storedAlertsRaw) : [];
      
      const todayVitals = allVitals
        .filter(v => isToday(parseISO(v.date)))
        .sort((a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime());
      setLatestVitals(todayVitals.length > 0 ? todayVitals[0] : null);

      const completedTasks = allTasks.filter(t => t.completed).length;
      setTaskProgress({ completed: completedTasks, total: allTasks.length });

      if (allAlerts.length > 0) {
        const sortedAlerts = allAlerts.sort((a, b) => parseISO(b.timestamp).getTime() - parseISO(a.timestamp).getTime());
        setLastAlert(sortedAlerts[0]);
      }

      const sevenDaysAgo = subDays(new Date(), 7);
      const weeklyVitals = allVitals.filter(v => parseISO(v.date) >= sevenDaysAgo);

      let status: 'Good' | 'Unstable' | 'Critical' = 'Good';
      let reason = "Vitals are stable.";
      
      let criticalCount = 0;
      let unstableCount = 0;

      weeklyVitals.forEach(v => {
        const systolic = v.systolic ? parseInt(v.systolic, 10) : 0;
        const bloodSugar = v.bloodSugar ? parseInt(v.bloodSugar, 10) : 0;
        const temperature = v.temperature ? parseFloat(v.temperature) : 0;

        if (systolic > 180 || bloodSugar > 300 || temperature > 103.1) {
          status = 'Critical';
          criticalCount++;
        } else if (status !== 'Critical' && (systolic > 140 || systolic < 90 || bloodSugar > 180)) {
          status = 'Unstable';
          unstableCount++;
        }
      });
      
      if (status === 'Critical') {
        reason = `Detected ${criticalCount} critical reading(s) this week.`;
      } else if (status === 'Unstable') {
        reason = `Detected ${unstableCount} unstable reading(s) this week.`
      }

      setWeeklyStatus({ status, reason });
    }
  }, [isClient]);

  const progressPercentage = taskProgress.total > 0 ? (taskProgress.completed / taskProgress.total) * 100 : 0;

  const StatusCard = useMemo(() => {
    if (!weeklyStatus) {
      return (
        <Card className="bg-secondary">
          <CardHeader><CardTitle>Weekly Status</CardTitle></CardHeader>
          <CardContent><p className="text-muted-foreground">Calculating...</p></CardContent>
        </Card>
      );
    }

    const { status, reason } = weeklyStatus;
    const statusConfig = {
      'Good': { icon: ShieldCheck, color: "text-green-600 dark:text-green-500", bg: "bg-green-50 dark:bg-green-950/50" },
      'Unstable': { icon: ShieldAlert, color: "text-yellow-600 dark:text-yellow-400", bg: "bg-yellow-50 dark:bg-yellow-950/50" },
      'Critical': { icon: ShieldX, color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-950/50" },
    };

    const Icon = statusConfig[status].icon;

    return (
      <Card className={cn("transition-all", statusConfig[status].bg)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icon className={cn("w-6 h-6", statusConfig[status].color)} />
            <span>Weekly Health Status</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className={cn("text-2xl font-bold mb-1", statusConfig[status].color)}>{status}</p>
          <p className="text-sm text-muted-foreground">{reason}</p>
        </CardContent>
      </Card>
    );
  }, [weeklyStatus]);

  if (!isClient) {
    return (
        <div className="flex flex-col gap-8">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <Card><CardHeader><CardTitle>Weekly Health Status</CardTitle></CardHeader><CardContent><div className="h-16 w-full bg-muted animate-pulse rounded-md" /></CardContent></Card>
                <Card><CardHeader><CardTitle>Today's Vitals</CardTitle></CardHeader><CardContent><div className="h-16 w-full bg-muted animate-pulse rounded-md" /></CardContent></Card>
                <Card><CardHeader><CardTitle>Daily Tasks</CardTitle></CardHeader><CardContent><div className="h-16 w-full bg-muted animate-pulse rounded-md" /></CardContent></Card>
            </div>
            <Card><CardHeader><CardTitle>Last Alert</CardTitle></CardHeader><CardContent><div className="h-12 w-full bg-muted animate-pulse rounded-md" /></CardContent></Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {StatusCard}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
                <HeartPulse className="w-5 h-5"/>
                <span>Today's Latest Vitals</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {latestVitals ? (
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                {latestVitals.systolic && latestVitals.diastolic && <div className="flex items-center gap-2"><HeartPulse className="w-4 h-4 text-destructive"/> <span className="font-semibold">{latestVitals.systolic}/{latestVitals.diastolic}</span><span className="text-muted-foreground">mmHg</span></div>}
                {latestVitals.oxygenLevel && <div className="flex items-center gap-2"><Activity className="w-4 h-4 text-primary"/> <span className="font-semibold">{latestVitals.oxygenLevel}%</span></div>}
                {latestVitals.temperature && <div className="flex items-center gap-2"><Thermometer className="w-4 h-4 text-accent-foreground"/> <span className="font-semibold">{latestVitals.temperature}°F</span></div>}
                {latestVitals.bloodSugar && <div className="flex items-center gap-2"><Droplets className="w-4 h-4 text-yellow-500"/> <span className="font-semibold">{latestVitals.bloodSugar}</span><span className="text-muted-foreground">mg/dL</span></div>}
                {latestVitals.weight && <div className="flex items-center gap-2"><Scale className="w-4 h-4 text-green-500"/> <span className="font-semibold">{latestVitals.weight} lbs</span></div>}
              </div>
            ) : (
              <p className="text-muted-foreground">No vitals recorded today.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
                <ListChecks className="w-5 h-5"/>
                <span>Daily Task Progress</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
                <div className="flex justify-between items-center text-sm text-muted-foreground">
                    <span>{taskProgress.completed} of {taskProgress.total} completed</span>
                    <span>{Math.round(progressPercentage)}%</span>
                </div>
                <Progress value={progressPercentage} className="h-2" />
            </div>
          </CardContent>
        </Card>
      </div>
      
      <Card>
        <CardHeader>
            <CardTitle className="flex items-center gap-2">
                <Siren className="w-5 h-5"/>
                <span>Last Alert Triggered</span>
            </CardTitle>
        </CardHeader>
        <CardContent>
            {lastAlert ? (
                <Alert variant="destructive" className="items-start">
                    <Siren className="h-4 w-4" />
                    <div className="w-full">
                        <AlertTitle>{lastAlert.message}</AlertTitle>
                        <AlertDescription>
                            Triggered {formatDistanceToNow(parseISO(lastAlert.timestamp), { addSuffix: true })}
                        </AlertDescription>
                    </div>
                </Alert>
            ) : (
                <p className="text-muted-foreground">No alerts have been triggered recently. All clear!</p>
            )}
        </CardContent>
      </Card>

      <HealthTips />
    </div>
  );
}
