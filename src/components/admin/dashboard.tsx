
"use client";

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2, ShieldCheck, UserCog, UserPlus, Stethoscope, Users } from 'lucide-react';
import { Separator } from '../ui/separator';
import { Input } from '../ui/input';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Skeleton } from '../ui/skeleton';

const settingsSchema = z.object({
  isPatientSignupDisabled: z.boolean().default(false),
  isDoctorSignupDisabled: z.boolean().default(false),
  isAdminSignupDisabled: z.boolean().default(true),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

const newAdminSchema = z.object({
  name: z.string().min(2, "Name is required."),
  email: z.string().email("Invalid email address."),
});

type NewAdminFormValues = z.infer<typeof newAdminSchema>;

interface AdminUser {
    id: string;
    name: string;
    email: string;
}

export function AdminDashboard() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [admins, setAdmins] = useState<AdminUser[]>([]);

  const settingsForm = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      isPatientSignupDisabled: false,
      isDoctorSignupDisabled: false,
      isAdminSignupDisabled: true,
    },
  });

  const newAdminForm = useForm<NewAdminFormValues>({
      resolver: zodResolver(newAdminSchema),
      defaultValues: { name: "", email: "" },
  });

  useEffect(() => {
    const fetchSettingsAndAdmins = async () => {
      setIsLoading(true);
      try {
        const settingsDocRef = doc(db, 'system_settings', 'signup_controls');
        const settingsSnap = await getDoc(settingsDocRef);
        if (settingsSnap.exists()) {
          settingsForm.reset(settingsSnap.data());
        }

        const adminQuery = query(collection(db, 'users'), where('role', '==', 'admin'));
        const adminSnapshot = await getDocs(adminQuery);
        setAdmins(adminSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AdminUser)));

      } catch (error) {
        console.error("Failed to fetch admin data:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not load dashboard data.' });
      } finally {
        setIsLoading(false);
      }
    };
    fetchSettingsAndAdmins();
  }, [settingsForm, toast]);

  const onSettingsSubmit = async (data: SettingsFormValues) => {
    try {
      setIsLoading(true);
      const settingsDocRef = doc(db, 'system_settings', 'signup_controls');
      await setDoc(settingsDocRef, { ...data, isAdminSignupDisabled: true }, { merge: true });
      toast({
        title: 'Settings Saved',
        description: 'Your changes to signup controls have been saved.',
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to save settings. Please try again.',
      });
    } finally {
        setIsLoading(false);
    }
  };
  
  const onNewAdminSubmit = (data: NewAdminFormValues) => {
    // This is a placeholder. Secure user creation must be done server-side.
    toast({
        title: "Feature In Development",
        description: "Secure admin creation requires server-side logic which is not yet implemented.",
    });
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl md:text-4xl font-bold">Admin Dashboard</h1>
        <p className="text-lg text-muted-foreground">Manage system-wide settings and controls.</p>
      </div>

        <div className="grid gap-8 lg:grid-cols-2 lg:items-start">
            <div className="space-y-8">
                <Card>
                    <CardHeader>
                    <CardTitle className="flex items-center gap-2"><UserCog/> Registration Control</CardTitle>
                    <CardDescription>
                        Enable or disable new user sign-ups for different roles.
                    </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin"/></div>
                        ) : (
                        <Form {...settingsForm}>
                            <form onSubmit={settingsForm.handleSubmit(onSettingsSubmit)} className="space-y-6">
                            <div className="space-y-4">
                                <FormField
                                    control={settingsForm.control}
                                    name="isPatientSignupDisabled"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                            <div className="space-y-0.5">
                                                <FormLabel className="text-base flex items-center gap-2"><UserPlus/> Patient Sign-ups</FormLabel>
                                                <p className="text-sm text-muted-foreground">Allow new patients to register.</p>
                                            </div>
                                            <FormControl>
                                                <Switch
                                                checked={!field.value}
                                                onCheckedChange={(checked) => field.onChange(!checked)}
                                                />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={settingsForm.control}
                                    name="isDoctorSignupDisabled"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                            <div className="space-y-0.5">
                                            <FormLabel className="text-base flex items-center gap-2"><Stethoscope/> Doctor Sign-ups</FormLabel>
                                            <p className="text-sm text-muted-foreground">Allow new doctors to register.</p>
                                            </div>
                                            <FormControl>
                                            <Switch
                                                checked={!field.value}
                                                onCheckedChange={(checked) => field.onChange(!checked)}
                                            />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={settingsForm.control}
                                    name="isAdminSignupDisabled"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 bg-secondary/50">
                                            <div className="space-y-0.5">
                                            <FormLabel className="text-base flex items-center gap-2"><ShieldCheck/> Admin Sign-ups</FormLabel>
                                            <p className="text-sm text-muted-foreground">Public registration is disabled after the first admin account is created.</p>
                                            </div>
                                            <FormControl>
                                            <Switch
                                                checked={!field.value}
                                                disabled={true}
                                            />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <Separator className="my-6"/>

                            <div className="flex justify-end">
                                <Button type="submit" disabled={isLoading}>
                                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Save Settings
                                </Button>
                            </div>
                            </form>
                        </Form>
                        )}
                    </CardContent>
                </Card>
            </div>
            
            <div className="space-y-8">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Users/> Admin Management</CardTitle>
                        <CardDescription>Create and manage administrator accounts.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div>
                             <h4 className="font-bold mb-2 text-md">Create New Admin</h4>
                             <Form {...newAdminForm}>
                                <form onSubmit={newAdminForm.handleSubmit(onNewAdminSubmit)} className="space-y-4 p-4 border rounded-lg">
                                     <FormField
                                        control={newAdminForm.control}
                                        name="name"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Full Name</FormLabel>
                                                <FormControl><Input placeholder="New Admin Name" {...field} /></FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={newAdminForm.control}
                                        name="email"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Email Address</FormLabel>
                                                <FormControl><Input placeholder="new.admin@example.com" {...field} /></FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <Alert>
                                        <AlertTitle>Note</AlertTitle>
                                        <AlertDescription>
                                           For security, new admin creation is handled by a server-side function. This UI is a placeholder until the backend logic is implemented. Clicking the button is currently disabled.
                                        </AlertDescription>
                                    </Alert>
                                    <Button type="submit" disabled>Create Admin</Button>
                                </form>
                             </Form>
                        </div>
                         <Separator />
                         <div>
                            <h4 className="font-bold mb-2 text-md">Current Administrators</h4>
                            <div className="space-y-2">
                                {isLoading ? <Skeleton className="h-10 w-full" /> : admins.map(admin => (
                                    <div key={admin.id} className="flex justify-between items-center p-3 bg-secondary rounded-md">
                                        <div>
                                            <p className="font-semibold">{admin.name}</p>
                                            <p className="text-sm text-muted-foreground">{admin.email}</p>
                                        </div>
                                        {/* Placeholder for future actions */}
                                        <Button variant="ghost" size="sm" disabled>Manage</Button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    </div>
  );
}
