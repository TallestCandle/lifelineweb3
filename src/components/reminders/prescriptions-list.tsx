
"use client";

import React, { useState, useEffect, useCallback } from 'react';
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Pill, PlusCircle, Trash2, BellRing, Check, X, CalendarDays, FileSpreadsheet } from "lucide-react";
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/auth-provider';
import { db } from '@/lib/firebase';
import { collection, doc, getDocs, addDoc, deleteDoc, query, orderBy, setDoc, where } from 'firebase/firestore';

interface Medication {
  name: string;
  dosage: string;
}

interface Prescription {
  caseId: string;
  createdAt: string; // ISO string of case creation
  medications: Medication[];
}

const reminderSchema = z.object({
  medicationName: z.string(),
  time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Please enter a valid time (HH:MM)."),
});
type ReminderFormValues = z.infer<typeof reminderSchema>;

interface Reminder extends ReminderFormValues {
  id: string;
  caseId: string;
}

type HistoryLog = Record<string, 'taken' | 'missed'>; // Reminder ID is the key
type History = Record<string, HistoryLog>; // Date string is the key

export function PrescriptionsList() {
    const { user } = useAuth();
    const { toast } = useToast();
    
    const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
    const [reminders, setReminders] = useState<Reminder[]>([]);
    const [history, setHistory] = useState<History>({});
    const [isLoading, setIsLoading] = useState(true);
    const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');

    const form = useForm<ReminderFormValues>({
        resolver: zodResolver(reminderSchema),
        defaultValues: { medicationName: "", time: "" },
    });

    useEffect(() => {
        if ('Notification' in window) {
            setNotificationPermission(Notification.permission);
        }
    }, []);

    // Fetch all data
    useEffect(() => {
        if (!user) {
            setIsLoading(false);
            return;
        }
        
        const fetchData = async () => {
            setIsLoading(true);
            try {
                // Fetch prescriptions from completed cases
                const investigationsCol = collection(db, 'investigations');
                const qCases = query(investigationsCol, where('userId', '==', user.uid));
                const casesSnap = await getDocs(qCases);
                
                const fetchedPrescriptions: Prescription[] = [];
                casesSnap.forEach(doc => {
                    const data = doc.data();
                    const planMeds = data.doctorPlan?.preliminaryMedications || [];
                    const finalMeds = data.finalTreatmentPlan?.medications || [];

                    const combinedMeds = [...planMeds, ...finalMeds].filter(m => m.name && m.dosage);

                    if (combinedMeds.length > 0) {
                        fetchedPrescriptions.push({
                            caseId: doc.id,
                            createdAt: data.createdAt,
                            medications: combinedMeds,
                        });
                    }
                });
                setPrescriptions(fetchedPrescriptions.sort((a,b) => parseISO(b.createdAt).getTime() - parseISO(a.createdAt).getTime()));

                // Fetch reminders
                const remindersCol = collection(db, `users/${user.uid}/reminders`);
                const qReminders = query(remindersCol, orderBy('time'));
                const remindersSnap = await getDocs(qReminders);
                setReminders(remindersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Reminder)));

                // Fetch history
                const historyCol = collection(db, `users/${user.uid}/reminders_history`);
                const historySnap = await getDocs(historyCol);
                const fetchedHistory: History = {};
                historySnap.forEach(doc => {
                    fetchedHistory[doc.id] = doc.data() as HistoryLog;
                });
                setHistory(fetchedHistory);

            } catch (error) {
                console.error("Error fetching data:", error);
                toast({ variant: 'destructive', title: "Error", description: "Could not load prescriptions data." });
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();

    }, [user, toast]);
    
    // Notification scheduler
    useEffect(() => {
        if (notificationPermission !== 'granted' || reminders.length === 0) return;

        const notifiedRemindersKey = `notified-reminders-${format(new Date(), 'yyyy-MM-dd')}`;

        const getNotifiedToday = (): string[] => {
            try {
                return JSON.parse(sessionStorage.getItem(notifiedRemindersKey) || '[]');
            } catch { return []; }
        }
        
        const markAsNotified = (reminderId: string) => {
            const notified = getNotifiedToday();
            if (!notified.includes(reminderId)) {
                sessionStorage.setItem(notifiedRemindersKey, JSON.stringify([...notified, reminderId]));
            }
        }

        const intervalId = setInterval(() => {
            const now = new Date();
            const todayStr = format(now, 'yyyy-MM-dd');
            const currentHistory = history[todayStr] || {};
            const notifiedToday = getNotifiedToday();
            
            reminders.forEach(reminder => {
                if (currentHistory[reminder.id] || notifiedToday.includes(reminder.id)) return;

                const [hour, minute] = reminder.time.split(':').map(Number);
                if (now.getHours() === hour && now.getMinutes() === minute) {
                    new Notification('Medication Reminder', { 
                        body: `It's time to take your ${reminder.medicationName}.`,
                        tag: `${todayStr}-${reminder.id}`
                    });
                    markAsNotified(reminder.id);
                }
            });
        }, 60000); 

        return () => clearInterval(intervalId);
    }, [notificationPermission, reminders, history]);

    const handleRequestNotificationPermission = useCallback(async () => {
        if (!('Notification' in window)) {
            toast({ variant: 'destructive', title: "Notifications not supported" });
            return;
        }
        const permission = await Notification.requestPermission();
        setNotificationPermission(permission);
    }, [toast]);

    const onAddReminder = useCallback(async (data: ReminderFormValues, caseId: string) => {
        if (!user) return;
        try {
            const remindersCol = collection(db, `users/${user.uid}/reminders`);
            const payload = { ...data, caseId };
            const docRef = await addDoc(remindersCol, payload);
            const newReminder: Reminder = { id: docRef.id, ...payload };
            setReminders(prev => [...prev, newReminder].sort((a, b) => a.time.localeCompare(b.time)));
            toast({ title: "Reminder Added" });
            form.reset({ medicationName: "", time: "" });
        } catch (error) {
            console.error("Error adding reminder:", error);
            toast({ variant: 'destructive', title: 'Error Saving Reminder' });
        }
    }, [user, toast, form]);

    const deleteReminder = useCallback(async (id: string) => {
        if (!user) return;
        try {
            await deleteDoc(doc(db, `users/${user.uid}/reminders`, id));
            setReminders(prev => prev.filter(r => r.id !== id));
            toast({ variant: 'destructive', title: "Reminder Removed" });
        } catch (error) {
            console.error("Error deleting reminder:", error);
            toast({ variant: 'destructive', title: 'Error Deleting Reminder' });
        }
    }, [user, toast]);

    const markReminder = useCallback(async (reminderId: string, status: 'taken' | 'missed') => {
        if (!user) return;
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        const updatedHistoryLog = { ...(history[todayStr] || {}), [reminderId]: status };
        
        try {
            const historyDocRef = doc(db, `users/${user.uid}/reminders_history`, todayStr);
            await setDoc(historyDocRef, updatedHistoryLog, { merge: true });
            setHistory(prev => ({ ...prev, [todayStr]: updatedHistoryLog }));
            toast({ title: `Marked as ${status}` });
        } catch (error) {
            console.error("Error updating status:", error);
            toast({ variant: 'destructive', title: 'Error Updating Status' });
        }
    }, [user, history, toast]);

    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const todayLog = history[todayStr] || {};
    
    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-3">
                        <FileSpreadsheet className="w-8 h-8 text-primary" />
                        <span className="text-2xl">My Prescriptions</span>
                    </CardTitle>
                    <CardDescription>
                        View all medications prescribed from your clinic cases. You can add reminders for any medication.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {notificationPermission !== 'granted' && (
                        <Alert className="mb-4">
                            <BellRing className="h-4 w-4" />
                            <AlertTitle>Enable Notifications</AlertTitle>
                            <AlertDescription>
                                Get timely alerts for your medications.
                                <Button variant="link" className="p-0 h-auto ml-2" onClick={handleRequestNotificationPermission}>Enable</Button>
                            </AlertDescription>
                        </Alert>
                    )}
                    
                    {isLoading ? <p>Loading prescriptions...</p> : prescriptions.length > 0 ? (
                        <Accordion type="single" collapsible className="w-full" defaultValue={prescriptions[0].caseId}>
                            {prescriptions.map(p => (
                                <AccordionItem value={p.caseId} key={p.caseId}>
                                    <AccordionTrigger>
                                        Prescription from {format(parseISO(p.createdAt), 'MMM d, yyyy')}
                                    </AccordionTrigger>
                                    <AccordionContent className="space-y-4">
                                        <ul className="space-y-2">
                                            {p.medications.map((med, index) => (
                                                <li key={index} className="p-3 bg-secondary rounded-md">
                                                    <p className="font-bold">{med.name}</p>
                                                    <p className="text-sm text-muted-foreground">{med.dosage}</p>
                                                </li>
                                            ))}
                                        </ul>
                                        <Card className="p-4">
                                            <p className="font-bold text-sm mb-2">Add a Reminder</p>
                                             <Form {...form}>
                                                <form onSubmit={form.handleSubmit((data) => onAddReminder(data, p.caseId))} className="grid sm:grid-cols-3 gap-4 items-end">
                                                    <FormField control={form.control} name="medicationName" render={({ field }) => (<FormItem><FormLabel>Medication</FormLabel><FormControl><Input placeholder="Medication name" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                                    <FormField control={form.control} name="time" render={({ field }) => (<FormItem><FormLabel>Time (24h)</FormLabel><FormControl><Input type="time" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                                    <Button type="submit">Add Reminder</Button>
                                                </form>
                                            </Form>
                                        </Card>
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                        </Accordion>
                    ) : (
                        <p className="text-muted-foreground text-center py-8">No prescriptions found.</p>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Today's Reminders</CardTitle>
                    <CardDescription>{format(new Date(), 'eeee, MMMM d')}</CardDescription>
                </CardHeader>
                <CardContent>
                    <ul className="space-y-3">
                        {reminders.length > 0 ? reminders.map(reminder => {
                            const status = todayLog[reminder.id];
                            return (
                                <li key={reminder.id} className="flex items-center justify-between p-3 rounded-md bg-secondary/50">
                                    <div className="flex items-center gap-4 min-w-0">
                                        <Pill className={cn("w-6 h-6 flex-shrink-0", status ? 'text-muted-foreground' : 'text-primary')} />
                                        <div className="min-w-0">
                                            <p className={cn("font-bold truncate", status && "line-through text-muted-foreground")}>{reminder.medicationName}</p>
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
        </div>
    );
}
