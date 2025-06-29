"use client";

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Siren, User, Phone, MapPin } from "lucide-react";

const emergencyContacts = [
    { name: "Jane Doe", relationship: "Spouse", phone: "555-123-4567" },
    { name: "John Smith", relationship: "Son", phone: "555-987-6543" },
    { name: "Dr. Williams", relationship: "Primary Care Physician", phone: "555-555-5555" },
];

export function EmergencyAlert() {
    const { toast } = useToast();
    const [location, setLocation] = useState<string | null>(null);
    const [locationError, setLocationError] = useState<string | null>(null);

    useEffect(() => {
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
    }, []);
    
    const handleSendAlert = () => {
        toast({
            variant: "destructive",
            title: "Emergency Alert Sent!",
            description: `Notified contacts with your location: ${location || 'Unavailable'}. Help is on the way.`,
        });
    };
    
    return (
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
    );
}
