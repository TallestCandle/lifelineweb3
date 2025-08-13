
"use client";

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';


import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Bot, ArrowLeft } from 'lucide-react';
import { Loader } from '../ui/loader';
import type { UserRole } from '@/context/auth-provider';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { ShieldAlert } from 'lucide-react';
import { useSettings } from '@/context/settings-provider';

const formSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address." }),
  password: z.string().min(6, { message: "Password must be at least 6 characters." }),
  name: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export function AuthForm({ onBack }: { onBack: () => void }) {
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const { settings } = useSettings();
  const router = useRouter();
  const { toast } = useToast();

  const isPatientSignupDisabled = settings?.signupControls?.isPatientSignupDisabled ?? false;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: "", password: "", name: "" },
  });

  const onSubmit = async (data: FormValues) => {
    setIsLoading(true);
    if (!auth) {
        toast({ variant: "destructive", title: "Configuration Error", description: "Firebase is not configured. Please check your environment variables." });
        setIsLoading(false);
        return;
    }
    try {
      if (isLogin) {
        const userCredential = await signInWithEmailAndPassword(auth, data.email, data.password);
        
        // Verify user role
        const userDocRef = doc(db, 'users', userCredential.user.uid);
        const docSnap = await getDoc(userDocRef);

        if (!docSnap.exists() || docSnap.data().role !== 'patient') {
          await auth.signOut(); // Log out the user
          throw new Error("This is not a patient account. Please use the appropriate portal to log in.");
        }
        
        toast({ title: "Login Successful", description: "Welcome back!" });
        router.push('/');
      } else {
        if(isPatientSignupDisabled) {
            throw new Error("Patient sign-ups are currently disabled by the administrator.");
        }
        if (!data.name) {
            form.setError("name", { type: "manual", message: "Name is required for sign up." });
            setIsLoading(false);
            return;
        }
        const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
        const user = userCredential.user;
        
        await updateProfile(user, { displayName: data.name });

        // Set user role and other details in Firestore 'users' collection
        const userDocRef = doc(db, 'users', user.uid);
        await setDoc(userDocRef, {
          role: 'patient' as UserRole,
          name: data.name,
          email: data.email,
          balance: 0, // Initialize balance to 0
          theme: 'theme-cool-flash', // Default theme
          // Other profile fields will be empty until updated by user
          age: '',
          gender: '',
          address: '',
          phone: '',
        });
        
        toast({ title: "Sign Up Successful", description: "Your account has been created. Let's set up your profile." });
        router.push('/profiles'); // Redirect to profile page to complete info
      }
    } catch (error: any) {
      let errorMessage = error.message || "An unexpected error occurred. Please try again.";
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
          errorMessage = "Invalid email or password.";
      } else if (error.code === 'auth/email-already-in-use') {
          errorMessage = "This email address is already in use.";
      }
      toast({ variant: "destructive", title: "Authentication Failed", description: errorMessage });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleForm = () => {
    setIsLogin(!isLogin);
    form.reset();
  };

  if (isLoading) {
    return <Loader />
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
       <div className="absolute inset-0 -z-10 h-full w-full bg-background bg-[radial-gradient(hsl(var(--primary)/0.1)_1px,transparent_1px)] [background-size:32px_32px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,#000_60%,transparent_100%)]"></div>
      <Card className="w-full max-w-md mx-4 bg-card/80 backdrop-blur-sm border-primary/20 relative">
        <Button variant="ghost" size="icon" className="absolute top-4 left-4" onClick={onBack}>
          <ArrowLeft />
        </Button>
        <CardHeader className="text-center pt-16">
            <div className="flex justify-center items-center gap-2 mb-4">
                <Bot className="w-10 h-10 text-primary"/>
                <h1 className="text-3xl font-bold">Lifeline</h1>
            </div>
          <CardTitle>{isLogin ? "Welcome Back" : "Create Your Account"}</CardTitle>
          <CardDescription>{isLogin ? "Sign in to access your health dashboard." : "Get started on your proactive health journey."}</CardDescription>
        </CardHeader>
        <CardContent>
          {!isLogin && isPatientSignupDisabled && (
            <Alert variant="destructive" className="mb-4">
                <ShieldAlert className="h-4 w-4" />
                <AlertTitle>Sign-ups Disabled</AlertTitle>
                <AlertDescription>
                    New patient registrations are currently not being accepted. Please check back later.
                </AlertDescription>
            </Alert>
          )}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {!isLogin && (
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl>
                        <Input placeholder="John Doe" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="you@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={isLoading || (!isLogin && isPatientSignupDisabled)}>
                {isLoading ? 'Processing...' : (isLogin ? 'Log In' : 'Sign Up')}
              </Button>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="text-center flex-col gap-2">
          <p className="text-sm text-muted-foreground">
            {isLogin ? "Don't have an account?" : "Already have an account?"}{' '}
            <Button variant="link" onClick={toggleForm} className="p-0 h-auto">
              {isLogin ? 'Sign Up' : 'Log In'}
            </Button>
          </p>
          <Button variant="link" size="sm" className="text-xs" onClick={() => router.push('/doctor/auth')}>
              Doctor Portal
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
