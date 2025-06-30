'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  FirebaseError,
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Stethoscope, User, BriefcaseMedical } from 'lucide-react';

const formSchema = z.object({
  email: z.string().email({ message: 'Invalid email address.' }),
  password: z
    .string()
    .min(6, { message: 'Password must be at least 6 characters.' }),
});

type FormValues = z.infer<typeof formSchema>;
type Role = 'patient' | 'doctor';

function AuthPortal({ role, activeTab, onTabChange }: { role: Role, activeTab: string, onTabChange: (value: string) => void }) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (values: FormValues) => {
    setIsLoading(true);
    form.clearErrors();

    if (!auth || !db) {
      toast({
        variant: 'destructive',
        title: 'Configuration Error',
        description: 'Firebase is not configured. Please add your Firebase credentials to the .env file.',
      });
      setIsLoading(false);
      return;
    }

    try {
      if (activeTab === 'signup') {
        const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password);
        const user = userCredential.user;
        // Save user role in Firestore
        await setDoc(doc(db, 'users', user.uid), {
            email: user.email,
            role: role,
            createdAt: new Date().toISOString(),
        });
        // The AuthGuard will handle redirection.
      } else { // Login
        const userCredential = await signInWithEmailAndPassword(auth, values.email, values.password);
        const user = userCredential.user;
        
        // Verify user role
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists() && userDoc.data().role === role) {
            // Role matches, AuthGuard will handle redirection.
        } else {
            // Mismatch or no role doc
            await signOut(auth);
            toast({
                variant: 'destructive',
                title: 'Login Error',
                description: `This account is not registered as a ${role}. Please use the correct portal.`,
            });
        }
      }
    } catch (error) {
      const firebaseError = error as FirebaseError;
      toast({
        variant: 'destructive',
        title: 'Authentication Error',
        description: firebaseError.message.replace('Firebase: ', ''),
      });
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <Tabs value={activeTab} onValueChange={onTabChange} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Login</TabsTrigger>
            <TabsTrigger value="signup">Sign Up</TabsTrigger>
        </TabsList>
        <TabsContent value="login">
            <Card>
                <CardHeader>
                    <CardTitle>Welcome Back</CardTitle>
                    <CardDescription>
                        Sign in to your Lifeline AI {role} account.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                            <FormField control={form.control} name="email" render={({ field }) => (<FormItem><FormLabel>Email</FormLabel><FormControl><Input placeholder="you@example.com" {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="password" render={({ field }) => (<FormItem><FormLabel>Password</FormLabel><FormControl><Input type="password" placeholder="••••••••" {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <Button type="submit" className="w-full" disabled={isLoading}>
                                {isLoading ? 'Loading...' : 'Login'}
                            </Button>
                        </form>
                    </Form>
                </CardContent>
            </Card>
        </TabsContent>
        <TabsContent value="signup">
            <Card>
                <CardHeader>
                    <CardTitle>Create {role === 'patient' ? 'an' : 'a Doctor'} Account</CardTitle>
                    <CardDescription>
                        Start your journey with Lifeline AI today.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                     <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                            <FormField control={form.control} name="email" render={({ field }) => (<FormItem><FormLabel>Email</FormLabel><FormControl><Input placeholder="you@example.com" {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="password" render={({ field }) => (<FormItem><FormLabel>Password</FormLabel><FormControl><Input type="password" placeholder="••••••••" {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <Button type="submit" className="w-full" disabled={isLoading}>
                                {isLoading ? 'Creating Account...' : 'Sign Up'}
                            </Button>
                        </form>
                    </Form>
                </CardContent>
            </Card>
        </TabsContent>
    </Tabs>
  )
}

export function AuthForm() {
  const [portal, setPortal] = useState<Role>('patient');
  const [activeTab, setActiveTab] = useState('login');

  const handlePortalChange = (value: string) => {
    setPortal(value as Role);
    setActiveTab('login'); // Reset to login tab on portal switch
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <div className="flex items-center gap-2">
            <Stethoscope className="w-12 h-12 text-primary" />
            <h1 className="text-3xl font-bold font-headline">Lifeline AI</h1>
          </div>
        </div>
        <Tabs value={portal} onValueChange={handlePortalChange} className="w-full">
          <TabsList className="grid w-full grid-cols-2 h-12">
            <TabsTrigger value="patient" className="h-full gap-2"><User /> Patient Portal</TabsTrigger>
            <TabsTrigger value="doctor" className="h-full gap-2"><BriefcaseMedical/> Doctor Portal</TabsTrigger>
          </TabsList>
          <TabsContent value="patient">
              <AuthPortal role="patient" activeTab={activeTab} onTabChange={setActiveTab} />
          </TabsContent>
          <TabsContent value="doctor">
              <AuthPortal role="doctor" activeTab={activeTab} onTabChange={setActiveTab} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
