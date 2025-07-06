
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/auth-provider';
import { getFirebaseMessaging } from '@/lib/firebase';
import { getToken } from 'firebase/messaging';
import { doc, setDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { BellRing } from 'lucide-react';
import { Button } from '../ui/button';

export function NotificationPermissionHandler() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [permission, setPermission] = useState<NotificationPermission | null>(null);

    useEffect(() => {
        if (typeof window !== 'undefined' && 'Notification' in window) {
            setPermission(Notification.permission);
        }
    }, []);

    const requestPermissionAndToken = async () => {
        if (!user || typeof window === 'undefined' || !('Notification' in window)) {
            return;
        }

        if (Notification.permission === 'granted') {
            handleTokenRegistration();
            return;
        }

        if (Notification.permission === 'denied') {
            toast({
                variant: 'destructive',
                title: 'Notification Permission Denied',
                description: 'Please enable notifications in your browser settings to receive alerts.',
            });
            return;
        }

        const newPermission = await Notification.requestPermission();
        setPermission(newPermission);
        if (newPermission === 'granted') {
            toast({ title: 'Notifications Enabled!' });
            handleTokenRegistration();
        } else {
            toast({
                variant: 'destructive',
                title: 'Notifications Not Enabled',
                description: 'You will not receive real-time alerts for new messages.',
            });
        }
    };

    const handleTokenRegistration = async () => {
        if (!user) return;
        
        try {
            const messaging = await getFirebaseMessaging();
            if (!messaging) return;

            const currentToken = await getToken(messaging, {
                vapidKey: 'YOUR_VAPID_KEY_FROM_FIREBASE_CONSOLE', // Replace this with your actual VAPID key
            });

            if (currentToken) {
                const tokenRef = doc(db, 'fcmTokens', user.uid);
                await setDoc(tokenRef, {
                    tokens: arrayUnion(currentToken),
                    lastUpdated: serverTimestamp(),
                }, { merge: true });
            } else {
                 toast({
                    variant: 'destructive',
                    title: 'Could Not Get Notification Token',
                    description: 'Your browser may not be fully supported for push notifications.',
                });
            }
        } catch (err) {
            console.error('An error occurred while retrieving token. ', err);
            toast({
                variant: 'destructive',
                title: 'Notification Setup Failed',
                description: 'An error occurred during setup. Please try again.',
            });
        }
    };
    
    // Auto-register token if permission is already granted
    useEffect(() => {
        if (user && permission === 'granted') {
            handleTokenRegistration();
        }
    }, [user, permission]);


    if (!user || permission === 'granted' || permission === 'denied') {
        return null;
    }

    return (
        <div className="fixed bottom-4 right-4 z-50">
            <div className="bg-card border rounded-lg p-4 shadow-lg max-w-sm">
                 <div className="flex items-start gap-3">
                    <BellRing className="h-6 w-6 text-primary mt-1"/>
                    <div>
                        <h4 className="font-bold">Enable Notifications</h4>
                        <p className="text-sm text-muted-foreground mt-1">Get real-time alerts for new messages from your doctor or patient.</p>
                        <Button size="sm" className="mt-3" onClick={requestPermissionAndToken}>
                            Enable Notifications
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}

