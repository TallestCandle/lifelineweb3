
"use client";

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Form, FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { Loader2, ShieldCheck, UserCog, UserPlus, Stethoscope } from 'lucide-react';
import { Separator } from '../ui/separator';

const settingsSchema = z.object({
  isPatientSignupDisabled: z.boolean().default(false),
  isDoctorSignupDisabled: z.boolean().default(false),
  isAdminSignupDisabled: z.boolean().default(true), // Should always be true after first admin
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

export function AdminDashboard() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      isPatientSignupDisabled: false,
      isDoctorSignupDisabled: false,
      isAdminSignupDisabled: true,
    },
  });

  useEffect(() => {
    const fetchSettings = async () => {
      setIsLoading(true);
      const settingsDocRef = doc(db, 'system_settings', 'signup_controls');
      const docSnap = await getDoc(settingsDocRef);
      if (docSnap.exists()) {
        form.reset(docSnap.data());
      }
      setIsLoading(false);
    };
    fetchSettings();
  }, [form]);

  const onSubmit = async (data: SettingsFormValues) => {
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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl md:text-4xl font-bold">Admin Dashboard</h1>
        <p className="text-lg text-muted-foreground">Manage system-wide settings and controls.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><UserCog/> Registration Control</CardTitle>
          <CardDescription>
            Enable or disable new user sign-ups for different roles. Disabling signup is a one-way action for admins.
          </CardDescription>
        </CardHeader>
        <CardContent>
            {isLoading ? (
                <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin"/></div>
            ) : (
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="space-y-4">
                    <FormField
                        control={form.control}
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
                        control={form.control}
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
                        control={form.control}
                        name="isAdminSignupDisabled"
                        render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 bg-secondary/50">
                                <div className="space-y-0.5">
                                <FormLabel className="text-base flex items-center gap-2"><ShieldCheck/> Admin Sign-ups</FormLabel>
                                <p className="text-sm text-muted-foreground">Admin registration is permanently disabled after the first account.</p>
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
  );
}
