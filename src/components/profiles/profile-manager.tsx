"use client";

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useProfile, Profile } from '@/context/profile-provider';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { User, UserPlus, Trash2, Edit, CheckCircle } from "lucide-react";
import { Avatar, AvatarFallback } from '../ui/avatar';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

const profileSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  age: z.string().refine((val) => !isNaN(parseInt(val, 10)) && parseInt(val, 10) > 0, { message: "Please enter a valid age." }),
  gender: z.enum(['Male', 'Female', 'Other'], { required_error: "Please select a gender." }),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export function ProfileManager() {
  const { profiles, activeProfile, addProfile, switchProfile, deleteProfile, updateProfile } = useProfile();
  const { toast } = useToast();
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: "",
      age: "",
      gender: undefined,
    },
  });

  const onEdit = (profile: Profile) => {
    setEditingProfile(profile);
    form.reset({
      name: profile.name,
      age: profile.age,
      gender: profile.gender,
    });
  };

  const onCancelEdit = () => {
    setEditingProfile(null);
    form.reset({ name: "", age: "", gender: undefined });
  };
  
  const onSubmit = async (values: ProfileFormValues) => {
    try {
      if (editingProfile) {
        await updateProfile(editingProfile.id, values);
        toast({ title: "Profile Updated", description: `${values.name}'s profile has been updated.` });
        onCancelEdit();
      } else {
        if (profiles.length >= 3) {
            toast({ variant: 'destructive', title: "Profile Limit Reached", description: "You can only have up to 3 profiles." });
            return;
        }
        await addProfile(values);
        toast({ title: "Profile Added", description: `${values.name} has been added.` });
        form.reset({ name: "", age: "", gender: undefined });
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    }
  };

  return (
    <div className="grid lg:grid-cols-3 gap-8 items-start">
      <div className="lg:col-span-1">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {editingProfile ? <Edit /> : <UserPlus />}
              {editingProfile ? 'Edit Profile' : 'Add New Profile'}
            </CardTitle>
            <CardDescription>
              {editingProfile ? `Editing ${editingProfile.name}'s profile.` : (profiles.length < 3 ? 'You can add up to 3 profiles.' : 'You have reached the maximum number of profiles.')}
            </CardDescription>
          </CardHeader>
          <CardContent>
             {(profiles.length < 3 || editingProfile) ? (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Name</FormLabel><FormControl><Input placeholder="John Doe" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="age" render={({ field }) => (<FormItem><FormLabel>Age</FormLabel><FormControl><Input type="number" placeholder="30" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="gender" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Gender</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="Male">Male</SelectItem>
                            <SelectItem value="Female">Female</SelectItem>
                            <SelectItem value="Other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex gap-2 pt-2">
                    {editingProfile && <Button type="button" variant="secondary" onClick={onCancelEdit}>Cancel</Button>}
                    <Button type="submit" className="w-full">{editingProfile ? 'Save Changes' : 'Add Profile'}</Button>
                  </div>
                </form>
              </Form>
             ) : (
                <p className="text-sm text-muted-foreground text-center">You cannot add more profiles.</p>
             )}
          </CardContent>
        </Card>
      </div>
      <div className="lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>Manage Profiles</CardTitle>
            <CardDescription>Select, edit, or delete profiles.</CardDescription>
          </CardHeader>
          <CardContent>
            {profiles.length > 0 ? (
              <ul className="space-y-4">
                {profiles.map(profile => (
                  <li key={profile.id} className="flex items-center justify-between p-4 rounded-md bg-secondary/50">
                    <div className="flex items-center gap-4">
                      <Avatar>
                        <AvatarFallback>{profile.name.charAt(0).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-bold">{profile.name}</p>
                        <p className="text-sm text-muted-foreground">{profile.age} years old, {profile.gender}</p>
                      </div>
                       {activeProfile?.id === profile.id && <CheckCircle className="w-5 h-5 text-green-500" />}
                    </div>
                    <div className="flex items-center gap-2">
                       {activeProfile?.id !== profile.id && (
                          <Button variant="outline" size="sm" onClick={() => switchProfile(profile.id)}>
                            Set Active
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" onClick={() => onEdit(profile)}><Edit className="w-4 h-4" /></Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                             <Button variant="ghost" size="icon" disabled={profiles.length <= 1}>
                                <Trash2 className="w-4 h-4 text-destructive" />
                             </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                              <AlertDialogDescription>This will permanently delete the profile for {profile.name} and all associated data. This action cannot be undone.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteProfile(profile.id)}>Delete</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-center py-10">
                <User className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-2 text-sm font-bold text-foreground">No profiles found</h3>
                <p className="mt-1 text-sm text-muted-foreground">Get started by adding a new profile.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
