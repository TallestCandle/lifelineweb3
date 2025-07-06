
"use client";

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useProfile } from '@/context/profile-provider';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { User, Edit } from "lucide-react";
import { useAuth } from '@/context/auth-provider';
import { Textarea } from '../ui/textarea';

const profileSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  age: z.string().refine((val) => !isNaN(parseInt(val, 10)) && parseInt(val, 10) > 0, { message: "Please enter a valid age." }),
  gender: z.enum(['Male', 'Female', 'Other'], { required_error: "Please select a gender." }),
  address: z.string().min(10, { message: "Please enter a valid address for home visits." }),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export function ProfileManager() {
  const { user } = useAuth();
  const { profile, createProfile, updateProfile } = useProfile();
  const { toast } = useToast();

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: "", age: "", gender: undefined, address: "" },
  });

  useEffect(() => {
    if (profile) {
      form.reset({
        name: profile.name,
        age: profile.age,
        gender: profile.gender,
        address: profile.address,
      });
    } else if (user?.displayName) {
      form.reset({ name: user.displayName, age: "", gender: undefined, address: "" });
    }
  }, [profile, user, form]);

  const onSubmit = async (values: ProfileFormValues) => {
    try {
      if (profile) {
        await updateProfile(values);
        toast({ title: "Profile Updated", description: "Your profile has been successfully updated. Redirecting..." });
      } else {
        await createProfile(values);
        toast({ title: "Profile Created", description: "Welcome! Your profile is now set up. Redirecting..." });
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    }
  };

  const pageTitle = profile ? "Edit Your Profile" : "Create Your Profile";
  const pageDescription = profile ? "Update your personal details below." : "Please tell us a bit about yourself to get started.";
  const buttonText = profile ? "Save Changes" : "Create Profile";

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-150px)]">
      <Card className="w-full max-w-lg mx-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {profile ? <Edit /> : <User />}
            {pageTitle}
          </CardTitle>
          <CardDescription>{pageDescription}</CardDescription>
        </CardHeader>
        <CardContent>
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
              )} />
              <FormField control={form.control} name="address" render={({ field }) => (
                <FormItem>
                    <FormLabel>Home Address</FormLabel>
                    <FormControl>
                        <Textarea placeholder="123 Main Street, Lagos, Nigeria" {...field} />
                    </FormControl>
                    <FormMessage />
                </FormItem>
              )} />
              <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'Saving...' : buttonText}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
