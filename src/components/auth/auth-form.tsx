
"use client";

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, signInWithPopup, GoogleAuthProvider, UserCredential } from 'firebase/auth';
import { auth, db, googleProvider } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';


import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Bot, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { Loader } from '../ui/loader';
import type { UserRole } from '@/context/auth-provider';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { ShieldAlert } from 'lucide-react';
import { useSettings } from '@/context/settings-provider';
import { Separator } from '../ui/separator';

const formSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address." }),
  password: z.string().min(6, { message: "Password must be at least 6 characters." }),
  name: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

const GoogleIcon = () => (
  <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-.97 2.53-2.09 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
    />
    <path
      fill="#EA4335"
      d="M12 5.16c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.99 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
    />
  </svg>
);

export function AuthForm({ onBack }: { onBack: () => void }) {
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { settings } = useSettings();
  const router = useRouter();
  const { toast } = useToast();

  const isPatientSignupDisabled = settings?.signupControls?.isPatientSignupDisabled ?? false;
  const isDoctorPortalEnabled = settings?.featureFlags?.isDoctorPortalEnabled ?? true;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: "", password: "", name: "" },
  });

  const handleAuthSuccess = async (userCredential: UserCredential, isNewUser: boolean = false) => {
    const user = userCredential.user;
    const userDocRef = doc(db, 'users', user.uid);

    if (isNewUser) {
        if (isPatientSignupDisabled) {
            await auth.signOut();
            throw new Error("Patient sign-ups are currently disabled.");
        }
        await setDoc(userDocRef, {
            role: 'patient' as UserRole,
            name: user.displayName,
            email: user.email,
            balance: 0,
            theme: 'theme-cool-flash',
            age: '', gender: '', address: '', phone: '',
        });
        toast({ title: "Sign Up Successful", description: "Let's set up your profile." });
    } else {
        const docSnap = await getDoc(userDocRef);
        if (!docSnap.exists() || docSnap.data().role !== 'patient') {
            await auth.signOut();
            throw new Error("This is not a patient account. Please use the doctor portal to log in.");
        }
        toast({ title: "Login Successful", description: "Welcome back!" });
    }
    router.push('/');
  };

  const handleAuthError = (error: any) => {
    // Gracefully handle popup closed by user
    if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
        return;
    }
    
    let errorMessage = error.message || "An unexpected error occurred.";
    if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        errorMessage = "Invalid email or password.";
    } else if (error.code === 'auth/email-already-in-use') {
        errorMessage = "This email address is already in use.";
    } else if (error.code === 'auth/account-exists-with-different-credential') {
        errorMessage = "An account already exists with this email address using a different sign-in method.";
    }
    toast({ variant: "destructive", title: "Authentication Failed", description: errorMessage });
  };
  
  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    if (!auth) {
      toast({ variant: "destructive", title: "Config Error", description: "Firebase authentication is not available." });
      setIsLoading(false);
      return;
    }
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const userDocRef = doc(db, 'users', result.user.uid);
      const docSnap = await getDoc(userDocRef);
      await handleAuthSuccess(result, !docSnap.exists());
    } catch (error: any) {
      handleAuthError(error);
    } finally {
      setIsLoading(false);
    }
  };

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
        await handleAuthSuccess(userCredential, false);
      } else {
        if (!data.name) {
            form.setError("name", { type: "manual", message: "Name is required for sign up." });
            setIsLoading(false);
            return;
        }
        const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
        await updateProfile(userCredential.user, { displayName: data.name });
        await handleAuthSuccess(userCredential, true);
      }
    } catch (error: any) {
      handleAuthError(error);
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

          <Button variant="outline" className="w-full mb-4" onClick={handleGoogleSignIn} disabled={isLoading || (!isLogin && isPatientSignupDisabled)}>
            <GoogleIcon /> Sign {isLogin ? 'in' : 'up'} with Google
          </Button>

          <div className="relative mb-4">
            <Separator />
            <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-sm text-muted-foreground">OR</span>
          </div>

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
                    <div className="relative">
                        <FormControl>
                            <Input type={showPassword ? "text" : "password"} placeholder="••••••••" {...field} />
                        </FormControl>
                        <Button type="button" variant="ghost" size="icon" className="absolute top-0 right-0 h-full w-10 text-muted-foreground" onClick={() => setShowPassword(!showPassword)}>
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={isLoading || (!isLogin && isPatientSignupDisabled)}>
                {isLoading ? 'Processing...' : (isLogin ? 'Log In with Email' : 'Sign Up with Email')}
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
          {isDoctorPortalEnabled && (
            <Button variant="link" size="sm" className="text-xs" onClick={() => router.push('/doctor/auth')}>
                Doctor Portal
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
