
"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/auth-provider';
import { db } from '@/lib/firebase';
import { collection, addDoc, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import Image from 'next/image';

import { initiateConsultation, type InitiateConsultationInput, type InitiateConsultationOutput } from '@/ai/flows/initiate-consultation-flow';

import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Loader } from '@/components/ui/loader';
import { Bot, PlusCircle, FileClock, Camera, Trash2, ShieldCheck } from 'lucide-react';

const consultationSchema = z.object({
  symptoms: z.string().min(20, { message: "Please describe your symptoms in at least 20 characters." }),
});
type ConsultationFormValues = z.infer<typeof consultationSchema>;

interface Consultation {
  id: string;
  status: 'pending_review' | 'approved' | 'rejected' | 'in_progress' | 'completed';
  createdAt: string;
  userInput: { symptoms: string; };
  aiAnalysis?: InitiateConsultationOutput;
  finalTreatmentPlan?: any;
}

const statusConfig = {
  pending_review: { text: 'Awaiting Doctor Review', color: 'bg-yellow-500' },
  approved: { text: 'Plan Approved', color: 'bg-green-500' },
  rejected: { text: 'Plan Rejected', color: 'bg-red-500' },
  in_progress: { text: 'Follow-up in Progress', color: 'bg-blue-500' },
  completed: { text: 'Consultation Completed', color: 'bg-gray-500' },
};

export function AiDoctorConsultation() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [view, setView] = useState<'form' | 'history'>('history');
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [imageDataUri, setImageDataUri] = useState<string | null>(null);
  
  const form = useForm<ConsultationFormValues>({
    resolver: zodResolver(consultationSchema),
    defaultValues: { symptoms: "" },
  });

  useEffect(() => {
    if (!user) return;
    setIsLoading(true);
    const q = query(collection(db, "consultations"), where("userId", "==", user.uid), orderBy("createdAt", "desc"));
    getDocs(q).then(snapshot => {
      setConsultations(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Consultation)));
      setIsLoading(false);
    }).catch(err => {
        console.error("Error fetching consultations: ", err);
        toast({variant: 'destructive', title: 'Error', description: 'Could not fetch past consultations.'});
        setIsLoading(false);
    });
  }, [user, toast]);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setImageDataUri(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const onSubmit = async (data: ConsultationFormValues) => {
    if (!user) return;
    setIsLoading(true);
    
    try {
      // Fetch recent health data to provide context to the AI
      const basePath = `users/${user.uid}`;
      
      const vitalsCol = collection(db, `${basePath}/vitals`);
      const stripsCol = collection(db, `${basePath}/test_strips`);
      const analysesCol = collection(db, `${basePath}/health_analyses`);

      const [vitalsSnap, stripsSnap, analysesSnap] = await Promise.all([
          getDocs(query(vitalsCol, orderBy('date', 'desc'), limit(100))),
          getDocs(query(stripsCol, orderBy('date', 'desc'), limit(100))),
          getDocs(query(analysesCol, orderBy('timestamp', 'desc'), limit(50))),
      ]);
      
      const vitalsHistory = vitalsSnap.docs.map(d => d.data());
      const testStripHistory = stripsSnap.docs.map(d => d.data());
      const previousAnalyses = analysesSnap.docs.map(d => d.data().analysisResult);

      const input: InitiateConsultationInput = {
        symptoms: data.symptoms,
        imageDataUri: imageDataUri || undefined,
        vitalsHistory: JSON.stringify(vitalsHistory),
        testStripHistory: JSON.stringify(testStripHistory),
        previousAnalyses: JSON.stringify(previousAnalyses),
      };

      const aiResponse = await initiateConsultation(input);

      const newConsultation = {
        userId: user.uid,
        userName: user.displayName || 'Anonymous',
        status: 'pending_review' as const,
        createdAt: new Date().toISOString(),
        userInput: {
            symptoms: data.symptoms,
            imageDataUri: input.imageDataUri,
        },
        aiAnalysis: aiResponse,
      };

      const docRef = await addDoc(collection(db, "consultations"), newConsultation);
      setConsultations(prev => [{ ...newConsultation, id: docRef.id }, ...prev]);
      
      toast({ title: 'Consultation Submitted', description: 'Your case has been sent for review. A doctor will approve your plan shortly.' });
      form.reset();
      setImageDataUri(null);
      setView('history');

    } catch (error) {
      console.error("Failed to start consultation:", error);
      toast({ variant: 'destructive', title: 'Submission Failed', description: 'Could not submit your consultation. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><Bot /> 24/7 AI Doctor Consultation</CardTitle>
            <CardDescription>Describe your symptoms and our AI will analyze your case with your health history.</CardDescription>
          </div>
          <Button onClick={() => setView(v => v === 'form' ? 'history' : 'form')}>
            {view === 'form' ? <><FileClock className="mr-2"/> View History</> : <><PlusCircle className="mr-2"/> New Consultation</>}
          </Button>
        </CardHeader>
      </Card>
      
      {view === 'form' ? (
        <Card>
            <CardHeader>
              <CardTitle>New Consultation Form</CardTitle>
              <CardDescription>The AI will automatically review your entire health history along with the symptoms you provide below.</CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <FormField control={form.control} name="symptoms" render={({ field }) => (<FormItem><FormLabel>Describe your symptoms in detail</FormLabel><FormControl><Textarea placeholder="e.g., I have had a headache for 2 days, a mild fever, and a runny nose..." {...field} rows={5} /></FormControl><FormMessage /></FormItem>)} />
                        
                        <FormItem>
                            <FormLabel className="flex items-center gap-2"><Camera /> Image Upload (Optional)</FormLabel>
                            <FormControl><Input type="file" accept="image/*" onChange={handleImageUpload} className="file:text-foreground" /></FormControl>
                            {imageDataUri && (
                                <div className="mt-4 relative w-fit">
                                    <Image src={imageDataUri} alt="Preview" width={150} height={150} className="rounded-md border" />
                                    <Button variant="destructive" size="icon" className="absolute -top-2 -right-2 rounded-full h-7 w-7" onClick={() => setImageDataUri(null)}>
                                        <Trash2 className="h-4 w-4" /><span className="sr-only">Remove</span>
                                    </Button>
                                </div>
                            )}
                        </FormItem>
                        <Button type="submit" className="w-full" disabled={isLoading}>{isLoading ? 'Analyzing Your Case...' : 'Submit for Review'}</Button>
                    </form>
                </Form>
            </CardContent>
        </Card>
      ) : (
        <Card>
            <CardHeader><CardTitle>Consultation History</CardTitle></CardHeader>
            <CardContent>
                {isLoading ? <Loader /> : consultations.length > 0 ? (
                    <Accordion type="single" collapsible className="w-full">
                        {consultations.map(c => (
                            <AccordionItem value={c.id} key={c.id}>
                                <AccordionTrigger>
                                    <div className="flex justify-between items-center w-full pr-4">
                                        <div className="flex items-center gap-3">
                                            <span className={`w-3 h-3 rounded-full ${statusConfig[c.status]?.color || 'bg-gray-400'}`} />
                                            <div className="text-left">
                                                <p>Consultation from {format(parseISO(c.createdAt), 'MMM d, yyyy')}</p>
                                                <p className="text-xs text-muted-foreground">{formatDistanceToNow(parseISO(c.createdAt), { addSuffix: true })}</p>
                                            </div>
                                        </div>
                                        <Badge variant="outline">{statusConfig[c.status]?.text}</Badge>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="space-y-4 pt-2">
                                    <p><strong className="font-bold">Symptoms Submitted:</strong> {c.userInput.symptoms}</p>
                                    {c.status === 'approved' && c.finalTreatmentPlan && (
                                        <Alert>
                                            <ShieldCheck className="h-4 w-4" />
                                            <AlertTitle>Doctor-Approved Treatment Plan</AlertTitle>
                                            <AlertDescription>
                                                <pre className="text-xs whitespace-pre-wrap font-mono bg-secondary p-2 rounded-md mt-2">
                                                    {typeof c.finalTreatmentPlan === 'string' ? c.finalTreatmentPlan : JSON.stringify(c.finalTreatmentPlan, null, 2)}
                                                </pre>
                                            </AlertDescription>
                                        </Alert>
                                    )}
                                     {c.status === 'pending_review' && (
                                        <Alert variant="default" className="bg-secondary">
                                            <AlertTitle>Awaiting Review</AlertTitle>
                                            <AlertDescription>An AI-generated plan is being reviewed by a licensed doctor. You will be notified upon approval.</AlertDescription>
                                        </Alert>
                                    )}
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                ) : (
                    <p className="text-muted-foreground text-center py-4">You have no past consultations.</p>
                )}
            </CardContent>
        </Card>
      )}
    </div>
  );
}
