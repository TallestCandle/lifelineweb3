
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
import { useRouter } from 'next/navigation';

const profileSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  age: z.string().refine((val) => !isNaN(parseInt(val, 10)) && parseInt(val, 10) > 0, { message: "Please enter a valid age." }),
  gender: z.enum(['Male', 'Female'], { required_error: "Please select a gender." }),
  phone: z.string().min(10, { message: "Please enter a valid phone number." }),
  address: z.string().min(10, { message: "Please enter a valid address for home visits." }),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export function ProfileManager() {
  const { user } = useAuth();
  const { profile, updateProfile } = useProfile();
  const { toast } = useToast();
  const router = useRouter();

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: "", age: "", gender: undefined, phone: "", address: "" },
  });

  useEffect(() => {
    if (profile) {
      form.reset({
        name: profile.name,
        age: profile.age,
        gender: profile.gender,
        phone: profile.phone,
        address: profile.address,
      });
    } else if (user?.displayName) {
      // Fallback for newly created user before profile is fully synced
      form.reset({ name: user.displayName, age: "", gender: undefined, phone: "", address: "" });
    }
  }, [profile, user, form]);
  
  const onSubmit = async (values: ProfileFormValues) => {
    try {
      await updateProfile(values);
      toast({ title: "Profile Updated", description: "Your profile has been successfully updated." });
      // Don't redirect if just updating
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    }
  };

  const isInitialSetup = !profile?.age; // Check if a core profile field is missing

  const pageTitle = isInitialSetup ? "Complete Your Profile" : "Edit Your Profile";
  const pageDescription = isInitialSetup ? "Please provide some essential details to get started." : "Update your personal details below.";
  const buttonText = isInitialSetup ? "Save and Continue" : "Save Changes";

  return (
    <div className="flex items-center justify-center">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {isInitialSetup ? <User /> : <Edit />}
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
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
               <FormField control={form.control} name="phone" render={({ field }) => (
                <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl>
                        <Input placeholder="e.g., 08012345678" {...field} />
                    </FormControl>
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
