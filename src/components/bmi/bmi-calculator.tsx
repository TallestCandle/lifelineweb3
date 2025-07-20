
"use client";

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { AnimatePresence, motion } from 'framer-motion';

import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/context/auth-provider';
import { db } from '@/lib/firebase';
import { collection, addDoc, query, orderBy, getDocs } from 'firebase/firestore';
import { generateBmiAdvice } from '@/ai/flows/generate-bmi-advice-flow';
import { Calculator, Lightbulb, LineChart, TrendingUp, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';

const bmiSchema = z.object({
  height: z.string().refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) > 50, {
    message: "Please enter a valid height in cm (e.g., 175).",
  }),
  weight: z.string().refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) > 20, {
    message: "Please enter a valid weight in kg (e.g., 70).",
  }),
});

type BmiFormValues = z.infer<typeof bmiSchema>;

interface BmiResult {
  bmi: number;
  category: 'Underweight' | 'Normal' | 'Overweight' | 'Obese';
  aiTip: string;
}

interface BmiHistoryEntry {
  id: string;
  date: string;
  bmi: number;
  weight: number;
  height: number;
}

const categoryConfig = {
  Underweight: { color: 'bg-blue-500', range: '< 18.5' },
  Normal: { color: 'bg-green-500', range: '18.5 - 24.9' },
  Overweight: { color: 'bg-yellow-500', range: '25 - 29.9' },
  Obese: { color: 'bg-red-500', range: '≥ 30' },
};

export function BmiCalculator() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [result, setResult] = useState<BmiResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState<BmiHistoryEntry[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);

  const form = useForm<BmiFormValues>({
    resolver: zodResolver(bmiSchema),
    defaultValues: { height: '', weight: '' },
  });

  useEffect(() => {
    if (!user) {
        setIsHistoryLoading(false);
        return;
    }
    const fetchHistory = async () => {
        setIsHistoryLoading(true);
        const historyCollection = collection(db, `users/${user.uid}/bmi_history`);
        const q = query(historyCollection, orderBy('date', 'desc'));
        const snapshot = await getDocs(q);
        setHistory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BmiHistoryEntry)));
        setIsHistoryLoading(false);
    };
    fetchHistory();
  }, [user]);

  const onSubmit = async ({ height, weight }: BmiFormValues) => {
    setIsLoading(true);
    setResult(null);

    const heightM = parseFloat(height) / 100;
    const weightKg = parseFloat(weight);
    const bmi = parseFloat((weightKg / (heightM * heightM)).toFixed(1));

    let category: BmiResult['category'];
    if (bmi < 18.5) category = 'Underweight';
    else if (bmi < 25) category = 'Normal';
    else if (bmi < 30) category = 'Overweight';
    else category = 'Obese';

    try {
      const { advice } = await generateBmiAdvice({ bmi, category });
      setResult({ bmi, category, aiTip: advice });
    } catch (error) {
      console.error("AI tip generation failed:", error);
      setResult({ bmi, category, aiTip: 'Focus on a balanced diet and regular exercise for optimal health.' });
    } finally {
      setIsLoading(false);
    }
  };

  const trackProgress = async () => {
    if (!result || !user) return;
    
    const height = parseFloat(form.getValues('height'));
    const weight = parseFloat(form.getValues('weight'));

    const newEntry = {
      date: new Date().toISOString(),
      bmi: result.bmi,
      height: height,
      weight: weight,
    };

    try {
        const historyCollection = collection(db, `users/${user.uid}/bmi_history`);
        const docRef = await addDoc(historyCollection, newEntry);
        setHistory(prev => [{ ...newEntry, id: docRef.id }, ...prev]);
        toast({ title: "Progress Tracked", description: `BMI of ${result.bmi} has been saved.` });
    } catch (error) {
        console.error("Failed to save BMI history:", error);
        toast({ variant: 'destructive', title: "Save Failed", description: "Could not save your BMI to history." });
    }
  };

  return (
    <div className="grid gap-8 md:grid-cols-2">
      <div className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Calculator /> BMI Calculator</CardTitle>
            <CardDescription>Enter your height and weight to calculate your Body Mass Index.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="height" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Height (cm)</FormLabel>
                    <FormControl><Input type="number" placeholder="e.g., 175" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="weight" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Weight (kg)</FormLabel>
                    <FormControl><Input type="number" placeholder="e.g., 70" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? 'Calculating...' : 'Calculate BMI'}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <AnimatePresence>
          {isLoading && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <Card>
                <CardContent className="p-6 text-center">
                    <Skeleton className="w-24 h-16 mx-auto" />
                    <Skeleton className="w-32 h-6 mx-auto mt-4" />
                    <Skeleton className="w-full h-4 mx-auto mt-4" />
                    <Skeleton className="w-full h-10 mt-6" />
                </CardContent>
              </Card>
            </motion.div>
          )}
          {result && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <Card>
                <CardHeader>
                  <CardTitle>Your Result</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="text-center">
                    <p className="text-muted-foreground">Your BMI</p>
                    <p className="text-6xl font-bold">{result.bmi}</p>
                    <p className={cn("font-bold text-lg", categoryConfig[result.category].color.replace('bg-', 'text-'))}>{result.category}</p>
                  </div>
                  
                  <div>
                    <div className="flex w-full h-2 rounded-full overflow-hidden">
                      {Object.values(categoryConfig).map(c => (
                        <div key={c.range} className={cn("h-full", c.color)} style={{ flexGrow: 1 }} />
                      ))}
                    </div>
                    <div className="flex w-full justify-between text-xs mt-1 text-muted-foreground">
                      {Object.values(categoryConfig).map(c => <span key={c.range}>{c.range}</span>)}
                    </div>
                  </div>

                  <Alert className="bg-primary/10 border-primary/20">
                    <Lightbulb className="h-4 w-4" />
                    <AlertTitle>AI Health Insight</AlertTitle>
                    <AlertDescription>{result.aiTip}</AlertDescription>
                  </Alert>

                  <Alert variant="default" className="border-accent bg-accent/10">
                     <AlertTriangle className="h-4 w-4 text-accent-foreground" />
                     <AlertTitle>Note</AlertTitle>
                     <AlertDescription>BMI is a general guide and does not account for factors like muscle mass. It is not a full diagnosis.</AlertDescription>
                   </Alert>
                </CardContent>
                <CardFooter>
                    <Button onClick={trackProgress} className="w-full">
                        <LineChart className="mr-2 h-4 w-4" />
                        Track Progress
                    </Button>
                </CardFooter>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><TrendingUp/> Progress History</CardTitle>
          <CardDescription>Review your past BMI entries.</CardDescription>
        </CardHeader>
        <CardContent>
            {isHistoryLoading ? <p>Loading history...</p> : history.length > 0 ? (
                <ul className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                    {history.map(item => (
                        <li key={item.id} className="flex justify-between items-center p-3 bg-secondary/50 rounded-lg">
                            <div>
                                <p className="font-bold">{item.bmi.toFixed(1)} <span className="text-sm text-muted-foreground">BMI</span></p>
                                <p className="text-xs text-muted-foreground">{format(parseISO(item.date), 'MMM d, yyyy')}</p>
                            </div>
                            <p className="text-sm text-muted-foreground">{item.weight}kg / {item.height}cm</p>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="text-center text-muted-foreground py-8">No BMI history recorded yet.</p>
            )}
        </CardContent>
      </Card>
    </div>
  );
}
