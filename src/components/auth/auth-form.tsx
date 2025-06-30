'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
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

export function AuthForm() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [role, setRole] = useState<Role>('patient');
  const [isLogin, setIsLogin] = useState(true);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: '', password: '' },
  });

  const handleRoleChange = (newRole: Role) => {
    setRole(newRole);
    form.reset(); // Reset form when switching roles
  };

  const toggleFormMode = () => {
    setIsLogin(!isLogin);
    form.reset();
  };

  const onSubmit = async (values: FormValues) => {
    setIsLoading(true);
    form.clearErrors();

    if (!auth || !db) {
      toast({
        variant: 'destructive',
        title: 'Configuration Error',
        description: 'Firebase is not configured correctly.',
      });
      setIsLoading(false);
      return;
    }

    try {
      if (isLogin) {
        // Login Logic
        const userCredential = await signInWithEmailAndPassword(auth, values.email, values.password);
        const user = userCredential.user;
        
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists() && userDoc.data().role === role) {
            // Success: Role matches, AuthGuard will handle redirection.
        } else {
            // Role mismatch or no role doc
            await signOut(auth);
            toast({
                variant: 'destructive',
                title: 'Login Error',
                description: `This account is not registered as a ${role}. Please use the correct portal.`,
            });
        }
      } else {
        // Signup Logic
        const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password);
        const user = userCredential.user;
        
        // Save user role in Firestore
        await setDoc(doc(db, 'users', user.uid), {
            email: user.email,
            role: role,
            createdAt: new Date().toISOString(),
        });
        // Success: AuthGuard will handle redirection.
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

  const title = isLogin ? 'Welcome Back' : 'Create an Account';
  const description = isLogin ? `Sign in to your ${role} account.` : `Get started as a ${role}.`;
  const submitButtonText = isLogin ? 'Sign In' : 'Create Account';
  const toggleLinkText = isLogin ? "Don't have an account? Sign Up" : "Already have an account? Sign In";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background animated-gradient-bg p-4">
      <Card className="w-full max-w-md shadow-2xl shadow-primary/10">
        <CardHeader className="text-center">
          <div className="mx-auto flex items-center justify-center gap-2 mb-4">
            <Stethoscope className="w-12 h-12 text-primary" />
            <h1 className="text-3xl font-bold font-headline">Lifeline AI</h1>
          </div>
          <div className="grid grid-cols-2 gap-2 p-1 bg-secondary rounded-lg">
            <Button
                variant={role === 'patient' ? 'default' : 'ghost'}
                onClick={() => handleRoleChange('patient')}
                className="h-11"
            >
                <User className="mr-2" />
                Patient
            </Button>
            <Button
                variant={role === 'doctor' ? 'default' : 'ghost'}
                onClick={() => handleRoleChange('doctor')}
                className="h-11"
            >
                <BriefcaseMedical className="mr-2" />
                Doctor
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-6 pb-6">
            <div className="mb-4 text-center">
                <CardTitle>{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
            </div>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Loading...' : submitButtonText}
              </Button>
            </form>
          </Form>
          <div className="mt-6 text-center text-sm">
            <Button variant="link" onClick={toggleFormMode} className="p-0 h-auto">
              {toggleLinkText}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
