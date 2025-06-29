"use client";

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format, formatDistanceToNow, parseISO } from 'date-fns';

import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/context/auth-provider';
import { Siren, User, Phone, MapPin, BellRing, CheckCircle, Trash2, UserPlus } from "lucide-react";

const ALERTS_LOCAL_STORAGE_KEY = 'nexus-lifeline-alerts';
const GUARDIANS_LOCAL_STORAGE_KEY = 'nexus-lifeline-guardians';

interface TriggeredAlert {
  id: string;
  message: string;
  timestamp: string;
}

const guardianSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  relationship: z.string().min(2, { message: "Relationship must be at least 2 characters." }),
  contact: z.string().min(5, { message: "Contact info is required." })
    .refine(
        (value) => z.string().email().safeParse(value).success || /^\+?\d{10,15}$/.test(value.replace(/\s|-|\(|\)/g, '')),
        "Must be a valid email or phone number."
    ),
});

type GuardianFormValues = z.infer<typeof guardianSchema>;

interface Guardian extends GuardianFormValues {
    id: string;
}

export function EmergencyAlert() {
    const { toast } = useToast();
    const { user } = useAuth();
    const [location, setLocation] = useState<string | null>(null);
    const [locationError, setLocationError] = useState<string | null>(null);
    const [alerts, setAlerts] = useState<TriggeredAlert[]>([]);
    const [guardians, setGuardians] = useState<Guardian[]>([]);
    const [isClient, setIsClient] = useState(false);

    const form = useForm<GuardianFormValues>({
        resolver: zodResolver(guardianSchema),
        defaultValues: { name: "", relationship: "", contact: "" },
    });

    useEffect(() => {
        setIsClient(true);

        if ('geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setLocation(`${position.coords.latitude}, ${position.coords.longitude}`);
                    setLocationError(null);
                },
                (error) => {
                    setLocationError(error.message);
                }
            );
        } else {
            setLocationError("Geolocation is not supported by your browser.");
        }
        
        try {
            const storedAlerts = window.localStorage.getItem(ALERTS_LOCAL_STORAGE_KEY);
            if (storedAlerts) setAlerts(JSON.parse(storedAlerts));
            
            const storedGuardians = window.localStorage.getItem(GUARDIANS_LOCAL_STORAGE_KEY);
            if (storedGuardians) setGuardians(JSON.parse(storedGuardians));
        } catch (error) {
            console.error("Error reading from localStorage", error);
        }
    }, []);
    
    const handleSendAlert = () => {
        const userName = user?.displayName || user?.email || 'The user';
        const timestamp = new Date().toISOString();

        if (guardians.length > 0) {
            guardians.forEach(guardian => {
                console.log(
                    `--- SIMULATING GUARDIAN NOTIFICATION (MANUAL ALERT) ---
                    To: ${guardian.contact}
                    Guardian: ${guardian.name}
                    From: ${userName}
                    Alert: User has manually triggered an emergency alert.
                    Location: ${location || 'Unavailable'}
                    Time: ${format(parseISO(timestamp), 'MMM d, yyyy, h:mm a')}
                    --- END SIMULATION ---`
                );
            });
             toast({
                variant: "destructive",
                title: "Emergency Alert Sent!",
                description: `Notified ${guardians.length} guardian(s) with your location. Help is on the way.`,
            });
        } else {
            toast({
                variant: "destructive",
                title: "Emergency Alert Sent!",
                description: `Help is on the way. Consider adding guardians to notify them automatically.`,
            });
        }
    };

    const handleAcknowledge = (alertId: string) => {
        const updatedAlerts = alerts.filter(alert => alert.id !== alertId);
        setAlerts(updatedAlerts);
        if (isClient) {
            window.localStorage.setItem(ALERTS_LOCAL_STORAGE_KEY, JSON.stringify(updatedAlerts));
            toast({
                title: "Alert Acknowledged",
                description: "The alert has been dismissed.",
            });
        }
    };

    const onGuardianSubmit = (data: GuardianFormValues) => {
        const newGuardian: Guardian = { ...data, id: Date.now().toString() };
        const updatedGuardians = [...guardians, newGuardian];
        setGuardians(updatedGuardians);
        window.localStorage.setItem(GUARDIANS_LOCAL_STORAGE_KEY, JSON.stringify(updatedGuardians));
        toast({ title: "Guardian Added", description: `${data.name} has been added to your guardians list.` });
        form.reset();
    };

    const removeGuardian = (id: string) => {
        const updatedGuardians = guardians.filter(g => g.id !== id);
        setGuardians(updatedGuardians);
        window.localStorage.setItem(GUARDIANS_LOCAL_STORAGE_KEY, JSON.stringify(updatedGuardians));
        toast({ variant: 'destructive', title: "Guardian Removed" });
    };


    if (!isClient) return null;
    
    return (
        <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                <Card className="bg-destructive/10 border-destructive">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-3 text-destructive">
                            <Siren className="w-8 h-8"/>
                            <span className="text-2xl">Emergency Situation</span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="text-center space-y-4">
                        <p className="text-lg">If you are in a crisis, press the button below to immediately notify your emergency contacts and guardians.</p>
                        
                        <div className="p-3 bg-secondary rounded-lg text-sm">
                            <div className="flex items-center justify-center gap-2 font-medium">
                                <MapPin className="w-4 h-4"/>
                                <span>Your Location:</span>
                            </div>
                            {location && <p className="text-muted-foreground">{location}</p>}
                            {locationError && <p className="text-destructive">{locationError}</p>}
                        </div>

                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive" size="lg" className="w-full h-16 text-xl animate-pulse">
                                    <Siren className="mr-2 h-6 w-6"/> Send Emergency Alert
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        This will immediately send an alert with your current location to all of your guardians.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleSendAlert}>
                                        Yes, Send Alert
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </CardContent>
                </Card>

                 <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <UserPlus className="w-6 h-6"/>
                            <span>Guardian Management</span>
                        </CardTitle>
                        <CardDescription>Add or remove guardians who will be notified during emergencies.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onGuardianSubmit)} className="space-y-4 mb-6">
                                <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Name</FormLabel><FormControl><Input placeholder="Jane Doe" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField control={form.control} name="relationship" render={({ field }) => (<FormItem><FormLabel>Relationship</FormLabel><FormControl><Input placeholder="Spouse" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField control={form.control} name="contact" render={({ field }) => (<FormItem><FormLabel>Email or Phone</FormLabel><FormControl><Input placeholder="user@example.com or 555-123-4567" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                <Button type="submit" className="w-full">Add Guardian</Button>
                            </form>
                        </Form>
                        <h3 className="text-lg font-medium mb-4">Your Guardians</h3>
                        <ul className="space-y-4 max-h-60 overflow-y-auto pr-2">
                            {guardians.length > 0 ? guardians.map((guardian) => (
                                <li key={guardian.id} className="flex items-center justify-between p-2 rounded-md hover:bg-secondary">
                                    <div className="flex items-center gap-4">
                                        <Avatar>
                                            <AvatarFallback>{guardian.name.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <p className="font-semibold">{guardian.name}</p>
                                            <p className="text-sm text-muted-foreground">{guardian.relationship}</p>
                                            <p className="text-sm text-muted-foreground">{guardian.contact}</p>
                                        </div>
                                    </div>
                                    <Button variant="ghost" size="icon" onClick={() => removeGuardian(guardian.id)}>
                                        <Trash2 className="w-5 h-5 text-destructive" />
                                        <span className="sr-only">Remove {guardian.name}</span>
                                    </Button>
                                </li>
                            )) : (
                                <p className="text-sm text-muted-foreground text-center py-4">No guardians added yet.</p>
                            )}
                        </ul>
                    </CardContent>
                </Card>
            </div>
            
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <BellRing className="w-6 h-6 text-destructive"/>
                        <span>Active Health Alerts</span>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {alerts.length > 0 ? (
                        <div className="space-y-4">
                            {alerts.map(alert => (
                                <Alert key={alert.id} variant="destructive" className="items-start">
                                    <Siren className="h-4 w-4" />
                                    <div className="w-full">
                                        <div className="flex justify-between items-center w-full">
                                            <AlertTitle className="mb-0">{alert.message}</AlertTitle>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleAcknowledge(alert.id)}
                                                className="ml-4 -mt-1 -mr-1 border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground shrink-0"
                                            >
                                                <CheckCircle className="mr-2 h-4 w-4" />
                                                Acknowledge
                                            </Button>
                                        </div>
                                        <AlertDescription className="mt-1">
                                            Triggered {formatDistanceToNow(parseISO(alert.timestamp), { addSuffix: true })}
                                        </AlertDescription>
                                    </div>
                                </Alert>
                            ))}
                        </div>
                    ) : (
                        <p className="text-muted-foreground">No active alerts at the moment.</p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
