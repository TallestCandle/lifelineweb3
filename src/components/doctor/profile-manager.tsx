
"use client";

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useDoctorProfile } from '@/context/doctor-profile-provider';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { User, Edit } from "lucide-react";
import { useAuth } from '@/context/auth-provider';

const profileSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  specialty: z.string().min(3, { message: "Specialty must be at least 3 characters." }),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export function DoctorProfileManager() {
  const { user } = useAuth();
  const { profile, createProfile, updateProfile } = useDoctorProfile();
  const { toast } = useToast();

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: "", specialty: "" },
  });

  useEffect(() => {
    if (profile) {
      form.reset({
        name: profile.name,
        specialty: profile.specialty,
      });
    } else if (user?.displayName) {
      form.reset({ name: user.displayName, specialty: "" });
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

  const pageTitle = profile ? "Edit Your Profile" : "Create Your Doctor Profile";
  const pageDescription = profile ? "Update your professional details below." : "Please tell us a bit about yourself to get started.";
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
              <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Full Name (e.g., Dr. Jane Doe)</FormLabel><FormControl><Input placeholder="Dr. Jane Doe" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="specialty" render={({ field }) => (<FormItem><FormLabel>Specialty</FormLabel><FormControl><Input placeholder="Cardiology" {...field} /></FormControl><FormMessage /></FormItem>)} />
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
