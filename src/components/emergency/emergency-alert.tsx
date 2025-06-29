"use client";

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Siren, User, Phone, MapPin, BellRing, CheckCircle } from "lucide-react";
import { formatDistanceToNow, parseISO } from 'date-fns';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const emergencyContacts = [
    { name: "Jane Doe", relationship: "Spouse", phone: "555-123-4567" },
    { name: "John Smith", relationship: "Son", phone: "555-987-6543" },
    { name: "Dr. Williams", relationship: "Primary Care Physician", phone: "555-555-5555" },
];

const ALERTS_LOCAL_STORAGE_KEY = 'nexus-lifeline-alerts';

interface TriggeredAlert {
  id: string;
  message: string;
  timestamp: string;
}

export function EmergencyAlert() {
    const { toast } = useToast();
    const [location, setLocation] = useState<string | null>(null);
    const [locationError, setLocationError] = useState<string | null>(null);
    const [alerts, setAlerts] = useState<TriggeredAlert[]>([]);
    const [isClient, setIsClient] = useState(false);

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
            if (storedAlerts) {
                setAlerts(JSON.parse(storedAlerts));
            }
        } catch (error) {
            console.error("Error reading alerts from localStorage", error);
        }
    }, []);
    
    const handleSendAlert = () => {
        toast({
            variant: "destructive",
            title: "Emergency Alert Sent!",
            description: `Notified contacts with your location: ${location || 'Unavailable'}. Help is on the way.`,
        });
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
                        <p className="text-lg">If you are in a crisis, press the button below to immediately notify your emergency contacts.</p>
                        
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
                                        This will immediately send an alert with your current location to all of your emergency contacts.
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
                        <CardTitle>Your Emergency Contacts</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ul className="space-y-4">
                            {emergencyContacts.map((contact, index) => (
                                <li key={index} className="flex items-center justify-between p-2 rounded-md hover:bg-secondary">
                                    <div className="flex items-center gap-4">
                                        <Avatar>
                                            <AvatarFallback><User/></AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <p className="font-semibold">{contact.name}</p>
                                            <p className="text-sm text-muted-foreground">{contact.relationship}</p>
                                        </div>
                                    </div>
                                    <Button variant="ghost" size="icon" asChild>
                                        <a href={`tel:${contact.phone}`} aria-label={`Call ${contact.name}`}>
                                            <Phone className="w-5 h-5 text-primary" />
                                        </a>
                                    </Button>
                                </li>
                            ))}
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
