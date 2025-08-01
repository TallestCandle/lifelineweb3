
"use client";

import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { addDays, subDays, format, parseISO, isSameDay } from 'date-fns';
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Droplet, HeartHandshake, Loader2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/auth-provider';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, orderBy, addDoc, limit } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';

const periodTrackerSchema = z.object({
  lastPeriodStartDate: z.date({
    required_error: "Your last period's start date is required.",
  }),
  cycleLength: z.coerce.number().min(20, "Cycle must be at least 20 days.").max(45, "Cycle cannot be longer than 45 days."),
});

type PeriodTrackerFormValues = z.infer<typeof periodTrackerSchema>;

interface CycleLog {
  id: string;
  startDate: string;
  cycleLength: number;
}

export function PeriodTracker() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [cycleLogs, setCycleLogs] = useState<CycleLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const latestLog = cycleLogs[0];

  const form = useForm<PeriodTrackerFormValues>({
    resolver: zodResolver(periodTrackerSchema),
    defaultValues: {
      cycleLength: 28,
    },
  });

  useEffect(() => {
    if (!user) {
        setIsLoading(false);
        return;
    }
    const q = query(collection(db, `users/${user.uid}/cycles`), orderBy('startDate', 'desc'), limit(12));
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CycleLog));
        setCycleLogs(logs);
        if (logs.length > 0) {
            form.reset({
                lastPeriodStartDate: parseISO(logs[0].startDate),
                cycleLength: logs[0].cycleLength,
            });
        }
        setIsLoading(false);
    });
    return () => unsubscribe();
  }, [user, form]);

  const cycleData = useMemo(() => {
    if (!latestLog) return null;

    const lastPeriodStart = parseISO(latestLog.startDate);
    const cycleLength = latestLog.cycleLength;
    const periodLength = 5; // Average period length

    const nextPeriodStart = addDays(lastPeriodStart, cycleLength);
    const ovulationDay = subDays(nextPeriodStart, 14);
    const fertileWindowStart = subDays(ovulationDay, 5);
    const fertileWindowEnd = ovulationDay;

    return {
      lastPeriodStart,
      nextPeriodStart,
      ovulationDay,
      fertileWindowStart,
      fertileWindowEnd,
      periodLength,
    };
  }, [latestLog]);

  const onSubmit = async (data: PeriodTrackerFormValues) => {
    if (!user) return;
    try {
      await addDoc(collection(db, `users/${user.uid}/cycles`), {
        startDate: data.lastPeriodStartDate.toISOString(),
        cycleLength: data.cycleLength,
      });
      toast({ title: 'Cycle Logged', description: 'Your cycle information has been saved.' });
    } catch (error) {
      console.error("Error logging cycle:", error);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not save your cycle information.' });
    }
  };

  const dayRenderer = (props: { date: Date; displayMonth: Date }): React.ReactNode => {
    const { date: day } = props;
    if (!day) return null;

    if (!cycleData) return <span className="text-foreground">{format(day, "d")}</span>;

    const { lastPeriodStart, nextPeriodStart, periodLength, fertileWindowStart, fertileWindowEnd, ovulationDay } = cycleData;
    let modifierClass = '';
    let isPeriod = false;

    // Check last period
    for (let i = 0; i < periodLength; i++) {
        if (isSameDay(day, addDays(lastPeriodStart, i))) {
            isPeriod = true;
            break;
        }
    }
    // Check next predicted period
    for (let i = 0; i < periodLength; i++) {
        if (isSameDay(day, addDays(nextPeriodStart, i))) {
            isPeriod = true;
            break;
        }
    }
    
    if (isPeriod) modifierClass = 'bg-red-400/20 text-red-300 rounded-full';
    if (day >= fertileWindowStart && day <= fertileWindowEnd) modifierClass = 'bg-green-400/20 text-green-300 rounded-full';
    if (isSameDay(day, ovulationDay)) modifierClass = 'bg-primary/30 text-primary rounded-full ring-2 ring-primary';
    
    return (
        <span className={cn("flex items-center justify-center w-full h-full", modifierClass)}>
            {format(day, "d")}
        </span>
    );
  };
  
  if (isLoading) {
    return <Loader2 className="w-8 h-8 animate-spin text-primary" />;
  }

  return (
    <div className="grid gap-8 md:grid-cols-3">
      <div className="md:col-span-2 space-y-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><HeartHandshake /> Period & Ovulation Tracker</CardTitle>
            <CardDescription>Log your cycle to get predictions for your next period, fertile window, and ovulation day.</CardDescription>
          </CardHeader>
          <CardContent>
            <Calendar
              mode="single"
              selected={currentMonth}
              onMonthChange={setCurrentMonth}
              month={currentMonth}
              className="p-0"
              classNames={{
                  day_today: "bg-accent/50 text-accent-foreground",
                  day: "w-full h-12 text-base",
              }}
              components={{
                  DayContent: dayRenderer as any,
              }}
            />
             <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm">
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-red-400/80"></span> Period</div>
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-green-400/80"></span> Fertile Window</div>
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-primary/80 ring-1 ring-primary-foreground"></span> Ovulation Day</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>Log Your Cycle</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="lastPeriodStartDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Last Period Start Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                            >
                              {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                  control={form.control}
                  name="cycleLength"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Average Cycle Length (days)</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full">Save Cycle</Button>
              </form>
            </Form>
          </CardContent>
        </Card>
        
        {cycleData && (
            <Card className="bg-secondary/50">
                <CardHeader>
                    <CardTitle className="text-lg">Cycle Insights</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <Alert>
                        <Droplet className="h-4 w-4" />
                        <AlertTitle>Next Period</AlertTitle>
                        <AlertDescription>
                            Your next period is predicted to start around <span className="font-bold">{format(cycleData.nextPeriodStart, 'MMMM d, yyyy')}</span>.
                        </AlertDescription>
                    </Alert>
                     <Alert>
                        <Sparkles className="h-4 w-4" />
                        <AlertTitle>Fertile Window</AlertTitle>
                        <AlertDescription>
                            Your fertile window is likely between <span className="font-bold">{format(cycleData.fertileWindowStart, 'MMM d')}</span> and <span className="font-bold">{format(cycleData.fertileWindowEnd, 'MMM d')}</span>.
                        </AlertDescription>
                    </Alert>
                </CardContent>
            </Card>
        )}
      </div>
    </div>
  );
}
