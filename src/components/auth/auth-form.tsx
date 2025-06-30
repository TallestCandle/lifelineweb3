'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  FirebaseError,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Stethoscope } from 'lucide-react';
import { useRouter } from 'next/navigation';

const formSchema = z.object({
  email: z.string().email({ message: 'Invalid email address.' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters.' }),
});

type FormValues = z.infer<typeof formSchema>;

export function AuthForm() {
  const { toast } = useToast();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isLogin, setIsLogin] = useState(true);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: '', password: '' },
  });

  const toggleFormMode = () => {
    setIsLogin(!isLogin);
    form.reset();
  };

  const onSubmit = async (values: FormValues) => {
    setIsLoading(true);
    form.clearErrors();

    if (!auth) {
      toast({
        variant: 'destructive',
        title: 'Authentication Error',
        description: 'Firebase is not configured correctly. Please contact support.',
      });
      setIsLoading(false);
      return;
    }

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, values.email, values.password);
      } else {
        await createUserWithEmailAndPassword(auth, values.email, values.password);
      }
      // On success, AuthGuard will handle redirection, but we can push immediately.
      router.push('/');
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
  const description = isLogin ? 'Sign in to your Lifeline AI account.' : 'Get started with Lifeline AI.';
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
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-6">
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
