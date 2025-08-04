
"use client";

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, collection, query, where, getDocs, updateDoc, deleteDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Form, FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { Loader2, ShieldCheck, UserCog, UserPlus, Stethoscope, Users, MoreVertical, Trash2, ShieldX, ShieldQuestion, ToggleRight } from 'lucide-react';
import { Skeleton } from '../ui/skeleton';
import { useAuth } from '@/context/auth-provider';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from '../ui/badge';
import { cn } from '@/lib/utils';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../ui/alert-dialog';
import { Label } from '../ui/label';

const settingsSchema = z.object({
  signupControls: z.object({
    isPatientSignupDisabled: z.boolean().default(false),
    isDoctorSignupDisabled: z.boolean().default(false),
    isAdminSignupDisabled: z.boolean().default(true),
  }),
  featureFlags: z.object({
    isClinicEnabled: z.boolean().default(true),
    isReportEnabled: z.boolean().default(true),
    isPrescriptionsEnabled: z.boolean().default(true),
  })
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

interface AdminUser {
    id: string;
    name: string;
    email: string;
    status: 'active' | 'suspended' | 'pending';
    permissions: {
        canManageSystem: boolean;
    };
}

export function AdminDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [currentUserPermissions, setCurrentUserPermissions] = useState({ canManageSystem: false });
  const [selectedAdmin, setSelectedAdmin] = useState<AdminUser | null>(null);

  const settingsForm = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      signupControls: {
        isPatientSignupDisabled: false,
        isDoctorSignupDisabled: false,
        isAdminSignupDisabled: true,
      },
      featureFlags: {
        isClinicEnabled: true,
        isReportEnabled: true,
        isPrescriptionsEnabled: true,
      }
    },
  });

  useEffect(() => {
    const fetchSettingsAndAdmins = async () => {
      setIsLoading(true);
      if (!user) return;
      try {
        // Fetch current user's permissions first
        const currentUserDocRef = doc(db, 'users', user.uid);
        const currentUserSnap = await getDoc(currentUserDocRef);
        if (currentUserSnap.exists()) {
            const userData = currentUserSnap.data();
            // If permissions object doesn't exist, this is the super admin.
            if (!userData.permissions) {
                setCurrentUserPermissions({ canManageSystem: true });
            } else {
                setCurrentUserPermissions(userData.permissions);
            }
        }

        // Fetch system-wide settings
        const settingsDocRef = doc(db, 'system_settings', 'controls');
        const settingsSnap = await getDoc(settingsDocRef);
        if (settingsSnap.exists()) {
          const data = settingsSnap.data();
          settingsForm.reset({
            signupControls: data.signupControls || settingsForm.getValues('signupControls'),
            featureFlags: data.featureFlags || settingsForm.getValues('featureFlags')
          });
        }

        // Fetch all admin users
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
  }, [user, settingsForm, toast]);

  const onSettingsSubmit = async (data: SettingsFormValues) => {
    try {
      setIsLoading(true);
      const settingsDocRef = doc(db, 'system_settings', 'controls');
      await setDoc(settingsDocRef, data, { merge: true });
      toast({
        title: 'Settings Saved',
        description: 'Your changes have been saved successfully.',
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

  const handleUpdateAdmin = async (adminId: string, updates: Partial<AdminUser>) => {
    const adminDocRef = doc(db, 'users', adminId);
    try {
        await updateDoc(adminDocRef, updates);
        setAdmins(prevAdmins => prevAdmins.map(admin => admin.id === adminId ? { ...admin, ...updates } : admin));
        toast({ title: 'Admin Updated', description: 'The administrator\'s details have been updated.' });
    } catch (error) {
        console.error("Error updating admin:", error);
        toast({ variant: 'destructive', title: 'Update Failed', description: 'Could not update administrator.' });
    }
  };

  const handleDeleteAdmin = async (adminId: string) => {
      // NOTE: This only deletes the Firestore record. For a production app,
      // you would need a Firebase Function to delete the associated Auth user.
      const adminDocRef = doc(db, 'users', adminId);
      try {
          await deleteDoc(adminDocRef);
          setAdmins(prevAdmins => prevAdmins.filter(admin => admin.id !== adminId));
          toast({ title: 'Admin Deleted', description: 'The administrator has been removed from the system.' });
      } catch (error) {
          console.error("Error deleting admin:", error);
          toast({ variant: 'destructive', title: 'Delete Failed', description: 'Could not delete administrator.' });
      }
  };

  const canManage = currentUserPermissions.canManageSystem;

  const statusConfig: Record<AdminUser['status'], { color: string; icon: React.ElementType }> = {
    active: { color: 'text-green-500', icon: ShieldCheck },
    suspended: { color: 'text-red-500', icon: ShieldX },
    pending: { color: 'text-yellow-500', icon: ShieldQuestion },
  };
  
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl md:text-4xl font-bold">Admin Dashboard</h1>
        <p className="text-lg text-muted-foreground">Manage system-wide settings and controls.</p>
      </div>

      <Form {...settingsForm}>
        <form onSubmit={settingsForm.handleSubmit(onSettingsSubmit)} className="grid gap-8 lg:grid-cols-2 lg:items-start">
            <div className="space-y-8">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><UserCog/> Registration Control</CardTitle>
                  <CardDescription>Enable or disable new user sign-ups for different roles.</CardDescription>
                </CardHeader>
                <CardContent>
                  <fieldset disabled={!canManage} className="space-y-4 group">
                    <div className="space-y-4 group-disabled:opacity-50 group-disabled:cursor-not-allowed">
                      <FormField control={settingsForm.control} name="signupControls.isPatientSignupDisabled" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4"><div className="space-y-0.5"><FormLabel className="text-base flex items-center gap-2"><UserPlus/> Patient Sign-ups</FormLabel></div><FormControl><Switch checked={!field.value} onCheckedChange={(checked) => field.onChange(!checked)} /></FormControl></FormItem>)} />
                      <FormField control={settingsForm.control} name="signupControls.isDoctorSignupDisabled" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4"><div className="space-y-0.5"><FormLabel className="text-base flex items-center gap-2"><Stethoscope/> Doctor Sign-ups</FormLabel></div><FormControl><Switch checked={!field.value} onCheckedChange={(checked) => field.onChange(!checked)}/></FormControl></FormItem>)} />
                      <FormField control={settingsForm.control} name="signupControls.isAdminSignupDisabled" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 bg-secondary/50"><div className="space-y-0.5"><FormLabel className="text-base flex items-center gap-2"><ShieldCheck/> Admin Sign-ups</FormLabel></div><FormControl><Switch checked={!field.value} onCheckedChange={(checked) => field.onChange(!checked)} /></FormControl></FormItem>)} />
                    </div>
                  </fieldset>
                </CardContent>
              </Card>

               <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><ToggleRight/> Feature Control</CardTitle>
                  <CardDescription>Enable or disable major application features for all users.</CardDescription>
                </CardHeader>
                <CardContent>
                  <fieldset disabled={!canManage} className="space-y-4 group">
                    <div className="space-y-4 group-disabled:opacity-50 group-disabled:cursor-not-allowed">
                       <FormField control={settingsForm.control} name="featureFlags.isClinicEnabled" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4"><FormLabel className="text-base">Clinic</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                       <FormField control={settingsForm.control} name="featureFlags.isReportEnabled" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4"><FormLabel className="text-base">Health Report</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                       <FormField control={settingsForm.control} name="featureFlags.isPrescriptionsEnabled" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4"><FormLabel className="text-base">Prescriptions</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                    </div>
                  </fieldset>
                </CardContent>
              </Card>
              
              <div className="flex justify-end sticky bottom-4">
                  <Button type="submit" size="lg" disabled={isLoading || !canManage} className="shadow-2xl">
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save All Settings
                  </Button>
              </div>
            </div>
            
            <div className="space-y-8 lg:sticky lg:top-24">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Users/> Admin Management</CardTitle>
                        <CardDescription>View and manage administrator accounts.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                         <div>
                            <div className="space-y-2">
                                {isLoading ? <Skeleton className="h-24 w-full" /> : admins.map(admin => {
                                  const statusInfo = statusConfig[admin.status] || statusConfig.pending;
                                  const StatusIcon = statusInfo.icon;
                                  return (
                                    <div key={admin.id} className="flex justify-between items-center p-3 bg-secondary rounded-md">
                                        <div className="flex items-center gap-3">
                                            <StatusIcon className={cn("w-5 h-5", statusInfo.color)} />
                                            <div>
                                                <p className="font-semibold">{admin.name}</p>
                                                <p className="text-sm text-muted-foreground">{admin.email}</p>
                                            </div>
                                        </div>
                                        <Badge variant={admin.status === 'active' ? 'default' : 'secondary'} className="capitalize">{admin.status || 'pending'}</Badge>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" disabled={user?.uid === admin.id || !canManage}><MoreVertical className="h-4 w-4"/></Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                <DropdownMenuItem onClick={() => setSelectedAdmin(admin)}>Manage Permissions</DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild><DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive">Delete Admin</DropdownMenuItem></AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                This action cannot be undone. This will permanently delete the admin account.
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                            <AlertDialogAction onClick={() => handleDeleteAdmin(admin.id)}>Delete</AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                )})}
                            </div>
                        </div>
                    </CardContent>
                </Card>
                {!canManage && (
                  <Alert variant="destructive">
                    <ShieldAlert className="h-4 w-4" />
                    <AlertTitle>Permissions Required</AlertTitle>
                    <AlertDescription>
                      You do not have sufficient permissions to manage system settings or other administrators.
                    </AlertDescription>
                  </Alert>
                )}
            </div>
        </form>
      </Form>
        
        {selectedAdmin && (
            <Dialog open={!!selectedAdmin} onOpenChange={() => setSelectedAdmin(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Manage Admin: {selectedAdmin.name}</DialogTitle>
                        <DialogDescription>Update status and permissions for this administrator.</DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="flex items-center justify-between rounded-lg border p-4">
                            <Label htmlFor="status-select" className="font-bold">Account Status</Label>
                            <select
                                id="status-select"
                                value={selectedAdmin.status}
                                onChange={(e) => handleUpdateAdmin(selectedAdmin.id, { status: e.target.value as AdminUser['status'] })}
                                className="p-2 rounded-md bg-secondary border-border"
                            >
                                <option value="pending">Pending</option>
                                <option value="active">Active</option>
                                <option value="suspended">Suspended</option>
                            </select>
                        </div>
                        <div className="flex items-center justify-between rounded-lg border p-4">
                            <Label htmlFor="permissions-switch" className="font-bold">Can Manage System</Label>
                             <Switch
                                id="permissions-switch"
                                checked={selectedAdmin.permissions?.canManageSystem}
                                onCheckedChange={(checked) => handleUpdateAdmin(selectedAdmin.id, { permissions: { canManageSystem: checked } })}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setSelectedAdmin(null)}>Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        )}
    </div>
  );
}
