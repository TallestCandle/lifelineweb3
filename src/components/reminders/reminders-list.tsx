"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format, parse, subDays, isToday, parseISO } from 'date-fns';

import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Pill, PlusCircle, Trash2, BellRing, Check, X, CalendarDays } from "lucide-react";
import { cn } from '@/lib/utils';

// Local storage keys
const REMINDERS_STORAGE_KEY = 'nexus-lifeline-reminders';
const HISTORY_STORAGE_KEY = 'nexus-lifeline-reminders-history';

// Zod schema for the form
const reminderSchema = z.object({
  name: z.string().min(2, "Medication name must be at least 2 characters."),
  time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Please enter a valid time (HH:MM)."),
});
type ReminderFormValues = z.infer<typeof reminderSchema>;

// Interfaces
interface Reminder extends ReminderFormValues {
  id: string;
}
type HistoryLog = Record<string, 'taken' | 'missed'>;
type History = Record<string, HistoryLog>; // Date string as key

export function RemindersList() {
    const [isClient, setIsClient] = useState(false);
    const [reminders, setReminders] = useState<Reminder[]>([]);
    const [history, setHistory] = useState<History>({});
    const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
    const { toast } = useToast();
    const form = useForm<ReminderFormValues>({
        resolver: zodResolver(reminderSchema),
        defaultValues: { name: "", time: "" },
    });

    // Load data from localStorage on mount
    useEffect(() => {
        setIsClient(true);
        try {
            const storedReminders = window.localStorage.getItem(REMINDERS_STORAGE_KEY);
            if (storedReminders) setReminders(JSON.parse(storedReminders));

            const storedHistory = window.localStorage.getItem(HISTORY_STORAGE_KEY);
            if (storedHistory) setHistory(JSON.parse(storedHistory));

            if ('Notification' in window) {
                setNotificationPermission(Notification.permission);
            }
        } catch (error) {
            console.error("Error reading from localStorage", error);
        }
    }, []);

    // Save data to localStorage when it changes
    useEffect(() => {
        if (isClient) {
            window.localStorage.setItem(REMINDERS_STORAGE_KEY, JSON.stringify(reminders));
            window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
        }
    }, [reminders, history, isClient]);
    
    // Effect for handling notifications
    useEffect(() => {
        if (!isClient || notificationPermission !== 'granted' || reminders.length === 0) return;

        const now = new Date();
        const todayStr = format(now, 'yyyy-MM-dd');
        const todayHistory = history[todayStr] || {};

        const timeoutIds: NodeJS.Timeout[] = [];

        reminders.forEach(reminder => {
            if (todayHistory[reminder.id]) return; // Skip if already handled

            const reminderTime = parse(reminder.time, 'HH:mm', new Date());
            if (reminderTime > now) {
                const timeoutId = setTimeout(() => {
                    new Notification('Medication Reminder', {
                        body: `It's time to take your ${reminder.name}.`,
                    });
                }, reminderTime.getTime() - now.getTime());
                timeoutIds.push(timeoutId);
            }
        });

        return () => {
            timeoutIds.forEach(clearTimeout);
        };
    }, [reminders, history, isClient, notificationPermission]);

    const handleRequestNotificationPermission = async () => {
        if (!('Notification' in window)) {
            toast({ variant: 'destructive', title: "Notifications not supported" });
            return;
        }
        const permission = await Notification.requestPermission();
        setNotificationPermission(permission);
        if (permission === 'granted') {
            toast({ title: "Notifications enabled!" });
        } else {
            toast({ variant: 'destructive', title: "Notifications denied." });
        }
    };

    const onSubmit = (data: ReminderFormValues) => {
        const newReminder: Reminder = { ...data, id: `reminder-${Date.now()}` };
        setReminders([...reminders, newReminder]);
        toast({ title: "Reminder Added", description: `${data.name} has been added.` });
        form.reset();
    };

    const deleteReminder = (id: string) => {
        setReminders(reminders.filter(r => r.id !== id));
        // Optional: clean up history for this reminder ID if needed
        toast({ variant: 'destructive', title: "Reminder Removed" });
    };

    const markReminder = (reminderId: string, status: 'taken' | 'missed') => {
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        setHistory(prev => ({
            ...prev,
            [todayStr]: {
                ...prev[todayStr],
                [reminderId]: status,
            }
        }));
        toast({ title: `Marked as ${status}` });
    };

    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const todayLog = history[todayStr] || {};
    
    const sortedReminders = useMemo(() => {
        return [...reminders].sort((a, b) => a.time.localeCompare(b.time));
    }, [reminders]);

    const pastSevenDays = useMemo(() => {
        return Array.from({ length: 7 }, (_, i) => format(subDays(new Date(), i + 1), 'yyyy-MM-dd'));
    }, []);

    if (!isClient) return null;

    return (
        <div className="grid lg:grid-cols-3 gap-8 items-start">
            <div className="lg:col-span-1 space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><PlusCircle /> Add Medication</CardTitle>
                        <CardDescription>Add a new medication or supplement to your daily reminders.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                                <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Medication Name</FormLabel><FormControl><Input placeholder="Ibuprofen" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField control={form.control} name="time" render={({ field }) => (<FormItem><FormLabel>Time (24h format)</FormLabel><FormControl><Input type="time" placeholder="08:00" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                <Button type="submit" className="w-full">Add Reminder</Button>
                            </form>
                        </Form>
                    </CardContent>
                </Card>
                {notificationPermission !== 'granted' && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><BellRing /> Enable Notifications</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground mb-4">Allow notifications to get timely alerts for your medications.</p>
                            <Button className="w-full" onClick={handleRequestNotificationPermission}>Enable Notifications</Button>
                        </CardContent>
                    </Card>
                )}
            </div>

            <div className="lg:col-span-2 space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Today's Reminders</CardTitle>
                        <CardDescription>{format(new Date(), 'eeee, MMMM d')}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ul className="space-y-3">
                            {sortedReminders.length > 0 ? sortedReminders.map(reminder => {
                                const status = todayLog[reminder.id];
                                return (
                                    <li key={reminder.id} className="flex items-center justify-between p-3 rounded-md bg-secondary/50">
                                        <div className="flex items-center gap-4">
                                            <Pill className={cn("w-6 h-6", status ? 'text-muted-foreground' : 'text-primary')} />
                                            <div>
                                                <p className={cn("font-semibold", status && "line-through text-muted-foreground")}>{reminder.name}</p>
                                                <p className="text-sm text-muted-foreground">{reminder.time}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {status === 'taken' && <Badge variant="outline" className="border-green-500 text-green-600">Taken</Badge>}
                                            {status === 'missed' && <Badge variant="destructive">Missed</Badge>}
                                            {!status && (
                                                <>
                                                    <Button size="sm" variant="outline" className="border-red-500 text-red-500 hover:bg-red-500 hover:text-white" onClick={() => markReminder(reminder.id, 'missed')}><X className="w-4 h-4 mr-1" /> Skip</Button>
                                                    <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => markReminder(reminder.id, 'taken')}><Check className="w-4 h-4 mr-1" /> Take</Button>
                                                </>
                                            )}
                                             <Button variant="ghost" size="icon" onClick={() => deleteReminder(reminder.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                                        </div>
                                    </li>
                                );
                            }) : (
                                <p className="text-muted-foreground text-center py-4">No reminders set up yet.</p>
                            )}
                        </ul>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><CalendarDays /> Reminder History</CardTitle>
                        <CardDescription>Review your medication history for the past week.</CardDescription>
                    </CardHeader>
                    <CardContent>
                       <Accordion type="single" collapsible className="w-full">
                            {pastSevenDays.map(dateStr => {
                                const log = history[dateStr] || {};
                                const hasLogs = reminders.some(r => log[r.id]);
                                if (!hasLogs) return null;

                                return (
                                    <AccordionItem value={dateStr} key={dateStr}>
                                        <AccordionTrigger>{isToday(parseISO(dateStr + 'T12:00:00Z')) ? 'Today' : format(parseISO(dateStr), 'eeee, MMMM d')}</AccordionTrigger>
                                        <AccordionContent>
                                            <ul className="space-y-2 pl-4">
                                                {reminders.map(r => {
                                                    const status = log[r.id];
                                                    if (!status) return null;
                                                    return (
                                                         <li key={`${dateStr}-${r.id}`} className="flex items-center gap-3 text-sm">
                                                            {status === 'taken' ? <Check className="w-4 h-4 text-green-500" /> : <X className="w-4 h-4 text-red-500" />}
                                                            <span>{r.name} at {r.time}</span>
                                                            <Badge variant={status === 'taken' ? 'default' : 'destructive'} className={status === 'taken' ? 'bg-green-100 text-green-800' : ''}>{status}</Badge>
                                                        </li>
                                                    )
                                                })}
                                            </ul>
                                        </AccordionContent>
                                    </AccordionItem>
                                );
                            })}
                        </Accordion>
                         {Object.keys(history).length === 0 && <p className="text-muted-foreground text-center py-4">No history recorded yet.</p>}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
