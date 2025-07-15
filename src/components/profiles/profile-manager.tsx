
"use client";

import { useEffect, useState } from 'react';
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
import { User, Edit, Wallet, CreditCard } from "lucide-react";
import { useAuth } from '@/context/auth-provider';
import { Textarea } from '../ui/textarea';
import { useRouter } from 'next/navigation';
import { usePaystackPayment } from 'react-paystack';
import { Separator } from '../ui/separator';

const profileSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  age: z.string().refine((val) => !isNaN(parseInt(val, 10)) && parseInt(val, 10) > 0, { message: "Please enter a valid age." }),
  gender: z.enum(['Male', 'Female'], { required_error: "Please select a gender." }),
  phone: z.string().min(10, { message: "Please enter a valid phone number." }),
  address: z.string().min(10, { message: "Please enter a valid address for home visits." }),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

const topUpPackages = [
    { amount: 1000, credits: 100, label: '₦1,000 for 100 Credits' },
    { amount: 2500, credits: 300, label: '₦2,500 for 300 Credits (20% Bonus)' },
    { amount: 5000, credits: 750, label: '₦5,000 for 750 Credits (50% Bonus)' },
];

export function ProfileManager() {
  const { user } = useAuth();
  const { profile, createProfile, updateProfile, updateCredits } = useProfile();
  const { toast } = useToast();
  const router = useRouter();
  const [selectedPackage, setSelectedPackage] = useState(topUpPackages[0]);

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
      form.reset({ name: user.displayName, age: "", gender: undefined, phone: "", address: "" });
    }
  }, [profile, user, form]);

  const paystackConfig = {
    reference: (new Date()).getTime().toString(),
    email: user?.email || 'user@example.com', // Provide a valid fallback
    amount: selectedPackage.amount * 100, // Amount in kobo
    publicKey: 'pk_test_2e295c0f33bc3198fe95dc1db020d03c82be94cb',
  };

  const onSuccess = async (reference: any) => {
    console.log('Payment successful', reference);
    try {
        await updateCredits(selectedPackage.credits);
        toast({
            title: "Top-up Successful!",
            description: `${selectedPackage.credits} credits have been added to your wallet.`,
        });
    } catch (error) {
        toast({ variant: 'destructive', title: "Credit Update Failed", description: "Your payment was successful but we failed to update your credits. Please contact support." });
    }
  };

  const onClose = () => {
    console.log('Payment dialog closed');
  };

  const initializePayment = usePaystackPayment(paystackConfig);

  const onSubmit = async (values: ProfileFormValues) => {
    try {
      if (profile) {
        await updateProfile(values);
        toast({ title: "Profile Updated", description: "Your profile has been successfully updated." });
      } else {
        await createProfile(values);
        toast({ title: "Profile Created", description: "Welcome! Your profile is now set up." });
        router.push('/');
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    }
  };

  const pageTitle = profile ? "Edit Your Profile" : "Create Your Profile";
  const pageDescription = profile ? "Update your personal details below." : "Please tell us a bit about yourself to get started.";
  const buttonText = profile ? "Save Changes" : "Create Profile";

  return (
    <div className="grid lg:grid-cols-2 gap-8 items-start">
      <Card className="w-full">
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
      
      {profile && (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Wallet/> My Wallet</CardTitle>
                <CardDescription>Top up your credits to use Lifeline's AI features.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="p-4 rounded-lg bg-secondary/50 flex justify-between items-center">
                    <p className="text-muted-foreground">Available Credits</p>
                    <p className="text-2xl font-bold text-primary">{profile.credits}</p>
                </div>

                <Separator />
                
                <div>
                    <h3 className="font-bold mb-2">Top-up Packages</h3>
                    <div className="space-y-2">
                        {topUpPackages.map((pkg) => (
                            <button
                                key={pkg.amount}
                                onClick={() => setSelectedPackage(pkg)}
                                className={`w-full p-3 rounded-md text-left transition-all border-2 ${selectedPackage.amount === pkg.amount ? 'border-primary bg-primary/10' : 'border-transparent bg-secondary/50 hover:bg-secondary'}`}
                            >
                                <p className="font-bold">{pkg.label}</p>
                                <p className="text-sm text-muted-foreground">{pkg.credits} credits will be added to your wallet.</p>
                            </button>
                        ))}
                    </div>
                </div>

                <Button
                    className="w-full"
                    onClick={() => initializePayment({onSuccess, onClose})}
                    disabled={!user?.email}
                >
                    <CreditCard className="mr-2"/>
                    Pay {new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(selectedPackage.amount)} with Paystack
                </Button>
            </CardContent>
        </Card>
      )}
    </div>
  );
}
