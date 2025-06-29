
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/context/auth-provider';
import { Siren, User, Phone, MapPin, BellRing, CheckCircle, Trash2, UserPlus, Copy } from "lucide-react";
import { useProfile } from '@/context/profile-provider';
import { db } from '@/lib/firebase';
import { collection, doc, getDocs, addDoc, deleteDoc, query, orderBy } from 'firebase/firestore';

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
    const { activeProfile } = useProfile();

    const [location, setLocation] = useState<string | null>(null);
    const [locationError, setLocationError] = useState<string | null>(null);
    const [alerts, setAlerts] = useState<TriggeredAlert[]>([]);
    const [guardians, setGuardians] = useState<Guardian[]>([]);
    const [isClient, setIsClient] = useState(false);
    const [callConfirmation, setCallConfirmation] = useState<{ name: string; contact: string } | null>(null);
    
    const form = useForm<GuardianFormValues>({
        resolver: zodResolver(guardianSchema),
        defaultValues: { name: "", relationship: "", contact: "" },
    });

    useEffect(() => {
        setIsClient(true);
        if ('geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(
                (position) => { setLocation(`${position.coords.latitude}, ${position.coords.longitude}`); setLocationError(null); },
                (error) => { setLocationError(error.message); }
            );
        } else {
            setLocationError("Geolocation is not supported by your browser.");
        }
    }, []);

    useEffect(() => {
        if (!isClient || !user || !activeProfile) return;
        
        const alertsCollectionRef = collection(db, `users/${user.uid}/profiles/${activeProfile.id}/alerts`);
        const guardiansCollectionRef = collection(db, `users/${user.uid}/profiles/${activeProfile.id}/guardians`);
        
        const fetchAlerts = async () => {
            const q = query(alertsCollectionRef, orderBy('timestamp', 'desc'));
            const snapshot = await getDocs(q);
            setAlerts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TriggeredAlert)));
        };

        const fetchGuardians = async () => {
            const snapshot = await getDocs(guardiansCollectionRef);
            setGuardians(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Guardian)));
        };

        Promise.all([fetchAlerts(), fetchGuardians()]).catch(error => console.error("Error fetching emergency data:", error));

    }, [isClient, user, activeProfile]);
    
    const handleSendAlert = async () => {
        if (!user || !activeProfile) return;
        const userName = activeProfile?.name || user?.email || 'The user';
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

        const alertsCollectionRef = collection(db, `users/${user.uid}/profiles/${activeProfile.id}/alerts`);
        const newAlert = {
            message: "User manually triggered an emergency alert.",
            timestamp,
        };
        const docRef = await addDoc(alertsCollectionRef, newAlert);
        setAlerts(prev => [{...newAlert, id: docRef.id}, ...prev]);
    };

    const handleAcknowledge = async (alertId: string) => {
        if (!user || !activeProfile) return;
        await deleteDoc(doc(db, `users/${user.uid}/profiles/${activeProfile.id}/alerts`, alertId));
        setAlerts(alerts.filter(alert => alert.id !== alertId));
        toast({
            title: "Alert Acknowledged",
            description: "The alert has been dismissed.",
        });
    };

    const onGuardianSubmit = async (data: GuardianFormValues) => {
        if (!user || !activeProfile) return;
        const guardiansCollectionRef = collection(db, `users/${user.uid}/profiles/${activeProfile.id}/guardians`);
        const docRef = await addDoc(guardiansCollectionRef, data);
        const newGuardian: Guardian = { ...data, id: docRef.id };
        setGuardians([...guardians, newGuardian]);
        toast({ title: "Guardian Added", description: `${data.name} has been added to your guardians list.` });
        form.reset();
    };

    const removeGuardian = async (id: string) => {
        if (!user || !activeProfile) return;
        await deleteDoc(doc(db, `users/${user.uid}/profiles/${activeProfile.id}/guardians`, id));
        setGuardians(guardians.filter(g => g.id !== id));
        toast({ variant: 'destructive', title: "Guardian Removed" });
    };

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text).then(() => {
            toast({ title: "Copied to clipboard!", description: text });
        }, (err) => {
            toast({ variant: 'destructive', title: "Failed to copy", description: err.message });
        });
    };

    const handleInitiateCall = () => {
        if (callConfirmation) {
            window.location.href = `tel:${callConfirmation.contact.replace(/\s|-|\(|\)/g, '')}`;
        }
        setCallConfirmation(null);
    };


    if (!isClient || !activeProfile) return null;
    
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
                            <div className="flex items-center justify-center gap-2">
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
                        <h3 className="text-lg font-bold mb-4">Your Guardians</h3>
                        <ul className="space-y-4 max-h-60 overflow-y-auto pr-2">
                            {guardians.length > 0 ? guardians.map((guardian) => (
                                <li key={guardian.id} className="flex items-center justify-between p-2 rounded-md hover:bg-secondary">
                                    <div className="flex items-center gap-4">
                                        <Avatar>
                                            <AvatarFallback>{guardian.name.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <p className="font-bold">{guardian.name}</p>
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

            <Dialog>
                <DialogTrigger asChild>
                    <Button variant="destructive" className="fixed bottom-8 right-8 rounded-full h-16 w-16 shadow-lg z-50">
                        <Siren className="h-8 w-8" />
                        <span className="sr-only">SOS</span>
                    </Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Quick Emergency Actions</DialogTitle>
                        <DialogDescription>
                            Contact your guardians or send a help signal immediately.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4 max-h-[50vh] overflow-y-auto">
                        {guardians.length > 0 ? guardians.map(guardian => (
                            <div key={guardian.id} className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                                <div>
                                    <p className="font-bold">{guardian.name}</p>
                                    <p className="text-sm text-muted-foreground">{guardian.contact}</p>
                                </div>
                                <div className="flex gap-2">
                                     <Button variant="outline" size="icon" onClick={() => setCallConfirmation({ name: guardian.name, contact: guardian.contact })}>
                                        <Phone className="w-4 h-4" />
                                        <span className="sr-only">Call {guardian.name}</span>
                                    </Button>
                                    <Button variant="outline" size="icon" onClick={() => handleCopy(guardian.contact)}>
                                        <Copy className="w-4 h-4" />
                                        <span className="sr-only">Copy contact</span>
                                    </Button>
                                </div>
                            </div>
                        )) : (
                            <p className="text-sm text-center text-muted-foreground">No guardians to contact. Please add guardians first.</p>
                        )}
                    </div>
                    <DialogFooter className="sm:justify-between gap-2">
                        <DialogClose asChild>
                            <Button type="button" variant="secondary">
                                Close
                            </Button>
                        </DialogClose>
                        <Button type="button" variant="destructive" onClick={handleSendAlert} disabled={guardians.length === 0}>
                            <Siren className="mr-2 h-4 w-4"/>
                            Send Help Signal
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!callConfirmation} onOpenChange={(isOpen) => !isOpen && setCallConfirmation(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Confirm Call</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to call {callConfirmation?.name} at {callConfirmation?.contact}?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setCallConfirmation(null)}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleInitiateCall}>Call</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
