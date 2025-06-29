
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format, subDays, isToday, parseISO } from 'date-fns';

import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Pill, PlusCircle, Trash2, BellRing, Check, X, CalendarDays } from "lucide-react";
import { cn } from '@/lib/utils';
import { useProfile } from '@/context/profile-provider';
import { useAuth } from '@/context/auth-provider';
import { db } from '@/lib/firebase';
import { collection, doc, getDocs, addDoc, deleteDoc, query, orderBy, setDoc } from 'firebase/firestore';

const reminderSchema = z.object({
  name: z.string().min(2, "Medication name must be at least 2 characters."),
  time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Please enter a valid time (HH:MM)."),
});
type ReminderFormValues = z.infer<typeof reminderSchema>;

interface Reminder extends ReminderFormValues {
  id: string;
}
type HistoryLog = Record<string, 'taken' | 'missed'>;
type History = Record<string, HistoryLog>; // Date string as key

export function RemindersList() {
    const [isClient, setIsClient] = useState(false);
    const { activeProfile } = useProfile();
    const { user } = useAuth();
    
    const [reminders, setReminders] = useState<Reminder[]>([]);
    const [history, setHistory] = useState<History>({});
    const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
    const { toast } = useToast();

    const form = useForm<ReminderFormValues>({
        resolver: zodResolver(reminderSchema),
        defaultValues: { name: "", time: "" },
    });

    useEffect(() => {
        setIsClient(true);
        if ('Notification' in window) {
            setNotificationPermission(Notification.permission);
        }
    }, []);

    // Effect for fetching data
    useEffect(() => {
        if (!isClient || !user || !activeProfile) {
            setReminders([]);
            setHistory({});
            return;
        }

        const loadData = async () => {
            try {
                // Fetch reminders
                const remindersCollectionRef = collection(db, `users/${user.uid}/profiles/${activeProfile.id}/reminders`);
                const qReminders = query(remindersCollectionRef, orderBy('time'));
                const remindersSnapshot = await getDocs(qReminders);
                setReminders(remindersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Reminder)));

                // Fetch history
                const historyCollectionRef = collection(db, `users/${user.uid}/profiles/${activeProfile.id}/reminders_history`);
                const historySnapshot = await getDocs(historyCollectionRef);
                const fetchedHistory: History = {};
                historySnapshot.forEach(doc => {
                    fetchedHistory[doc.id] = doc.data() as HistoryLog;
                });
                setHistory(fetchedHistory);

            } catch (error) {
                console.error("Error fetching reminder data:", error);
                toast({
                    variant: 'destructive',
                    title: 'Error Loading Data',
                    description: 'Could not load your reminders. Please check your connection and try again.',
                });
            }
        };

        loadData();
    }, [isClient, user, activeProfile, toast]);

    // Effect for notifications
    useEffect(() => {
        if (!isClient || notificationPermission !== 'granted' || reminders.length === 0) return;

        const notifiedRemindersKey = `notified-reminders-${format(new Date(), 'yyyy-MM-dd')}`;

        const getNotifiedToday = (): string[] => {
            try {
                return JSON.parse(sessionStorage.getItem(notifiedRemindersKey) || '[]');
            } catch {
                return [];
            }
        }
        
        const markAsNotified = (reminderId: string) => {
            const notified = getNotifiedToday();
            if (!notified.includes(reminderId)) {
                sessionStorage.setItem(notifiedRemindersKey, JSON.stringify([...notified, reminderId]));
            }
        }

        const checkReminders = () => {
            const now = new Date();
            const todayStr = format(now, 'yyyy-MM-dd');
            const currentHistory = history[todayStr] || {};
            const notifiedToday = getNotifiedToday();
            
            reminders.forEach(reminder => {
                if (currentHistory[reminder.id] || notifiedToday.includes(reminder.id)) {
                    return;
                }

                const [hour, minute] = reminder.time.split(':').map(Number);
                if (now.getHours() === hour && now.getMinutes() === minute) {
                    new Notification('Medication Reminder', { 
                        body: `It's time to take your ${reminder.name}.`,
                        tag: `${todayStr}-${reminder.id}`
                    });
                    markAsNotified(reminder.id);
                }
            });
        };

        const intervalId = setInterval(checkReminders, 60000); 

        return () => {
            clearInterval(intervalId);
        };
    }, [isClient, notificationPermission, reminders, history]);

    const handleRequestNotificationPermission = useCallback(async () => {
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
    }, [toast]);

    const onSubmit = useCallback(async (data: ReminderFormValues) => {
        if (!user || !activeProfile) return;
        try {
            const remindersCollectionRef = collection(db, `users/${user.uid}/profiles/${activeProfile.id}/reminders`);
            const docRef = await addDoc(remindersCollectionRef, data);
            const newReminder: Reminder = { ...data, id: docRef.id };
            setReminders(prev => [...prev, newReminder].sort((a, b) => a.time.localeCompare(b.time)));
            toast({ title: "Reminder Added", description: `${data.name} has been added.` });
            form.reset();
        } catch (error) {
            console.error("Error adding reminder:", error);
            toast({
                variant: 'destructive',
                title: 'Error Saving Reminder',
                description: 'Could not save your new reminder. Please try again.',
            });
        }
    }, [user, activeProfile, toast, form]);

    const deleteReminder = useCallback(async (id: string) => {
        if (!user || !activeProfile) return;
        try {
            await deleteDoc(doc(db, `users/${user.uid}/profiles/${activeProfile.id}/reminders`, id));
            setReminders(prev => prev.filter(r => r.id !== id));
            toast({ variant: 'destructive', title: "Reminder Removed" });
        } catch (error) {
            console.error("Error deleting reminder:", error);
            toast({
                variant: 'destructive',
                title: 'Error Deleting Reminder',
                description: 'Could not remove the reminder. Please try again.',
            });
        }
    }, [user, activeProfile, toast]);

    const markReminder = useCallback(async (reminderId: string, status: 'taken' | 'missed') => {
        if (!user || !activeProfile) return;
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        
        const updatedHistoryLog = { ...(history[todayStr] || {}), [reminderId]: status };
        
        try {
            const historyDocRef = doc(db, `users/${user.uid}/profiles/${activeProfile.id}/reminders_history`, todayStr);
            await setDoc(historyDocRef, updatedHistoryLog, { merge: true });

            setHistory(prev => ({ ...prev, [todayStr]: updatedHistoryLog }));
            toast({ title: `Marked as ${status}` });
        } catch (error) {
            console.error("Error updating reminder status:", error);
            toast({
                variant: 'destructive',
                title: 'Error Updating Status',
                description: 'Could not update the reminder status. Please try again.',
            });
        }
    }, [user, activeProfile, history, toast]);

    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const todayLog = history[todayStr] || {};
    
    const sortedReminders = useMemo(() => {
        return [...reminders].sort((a, b) => a.time.localeCompare(b.time));
    }, [reminders]);

    const pastSevenDays = Array.from({ length: 7 }, (_, i) => format(subDays(new Date(), i), 'yyyy-MM-dd')).reverse();

    if (!isClient || !activeProfile) return null;

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
                                        <div className="flex items-center gap-4 min-w-0">
                                            <Pill className={cn("w-6 h-6 flex-shrink-0", status ? 'text-muted-foreground' : 'text-primary')} />
                                            <div className="min-w-0">
                                                <p className={cn("font-bold truncate", status && "line-through text-muted-foreground")}>{reminder.name}</p>
                                                <p className="text-sm text-muted-foreground">{reminder.time}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 flex-shrink-0">
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
                                        <AccordionTrigger>{isToday(parseISO(dateStr)) ? 'Today' : format(parseISO(dateStr), 'eeee, MMMM d')}</AccordionTrigger>
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
                         {Object.keys(history).filter(dateStr => reminders.some(r => history[dateStr]?.[r.id])).length === 0 && <p className="text-muted-foreground text-center py-4">No history recorded yet.</p>}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
