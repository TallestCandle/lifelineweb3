
"use client";

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { AnimatePresence, motion } from 'framer-motion';

import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Ruler, AlertTriangle, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from '@/context/auth-provider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';

const baseSchema = z.object({
  waist: z.string().refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0, { message: "Enter a valid waist circumference in cm." }),
  height: z.string().optional(),
  hip: z.string().optional(),
  gender: z.enum(['Male', 'Female']).optional(),
});

type FormValues = z.infer<typeof baseSchema>;

interface Result {
  value: string;
  category: 'Low Risk' | 'Increased Risk' | 'High Risk' | 'Very High Risk';
  message: string;
}

const riskConfig = {
  'Low Risk': { color: 'text-green-500' },
  'Increased Risk': { color: 'text-yellow-500' },
  'High Risk': { color: 'text-orange-500' },
  'Very High Risk': { color: 'text-red-500' },
};

function CalculatorTab({
  title,
  description,
  fields,
  calculate,
}: {
  title: string,
  description: string,
  fields: ('waist' | 'height' | 'hip' | 'gender')[],
  calculate: (values: FormValues) => Result | null
}) {
  const [result, setResult] = useState<Result | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(baseSchema),
    defaultValues: { waist: '', height: '', hip: '', gender: undefined },
  });

  const onSubmit = (data: FormValues) => {
    const calculationResult = calculate(data);
    setResult(calculationResult);
  };

  return (
    <Card className="border-0 shadow-none">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {fields.includes('waist') && <FormField control={form.control} name="waist" render={({ field }) => (<FormItem><FormLabel>Waist (cm)</FormLabel><FormControl><Input type="number" placeholder="e.g., 85" {...field} /></FormControl><FormMessage /></FormItem>)} />}
                {fields.includes('height') && <FormField control={form.control} name="height" render={({ field }) => (<FormItem><FormLabel>Height (cm)</FormLabel><FormControl><Input type="number" placeholder="e.g., 175" {...field} /></FormControl><FormMessage /></FormItem>)} />}
                {fields.includes('hip') && <FormField control={form.control} name="hip" render={({ field }) => (<FormItem><FormLabel>Hip (cm)</FormLabel><FormControl><Input type="number" placeholder="e.g., 95" {...field} /></FormControl><FormMessage /></FormItem>)} />}
                {fields.includes('gender') && <FormField control={form.control} name="gender" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Gender</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger></FormControl>
                            <SelectContent>
                                <SelectItem value="Male">Male</SelectItem>
                                <SelectItem value="Female">Female</SelectItem>
                            </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                )} />}
            </div>
            <Button type="submit" className="w-full">Calculate</Button>
          </form>
        </Form>
      </CardContent>
      <AnimatePresence>
        {result && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <CardFooter>
              <Alert className="w-full">
                <Ruler className="h-4 w-4" />
                <AlertTitle className={cn("flex justify-between items-center", riskConfig[result.category].color)}>
                  <span>{result.value}</span>
                  <span>{result.category}</span>
                </AlertTitle>
                <AlertDescription>{result.message}</AlertDescription>
              </Alert>
            </CardFooter>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

export function BodyMetricsCalculator() {
    const { user } = useAuth();

    const calculateWaistCircumference = (values: FormValues): Result | null => {
        const { waist, gender } = values;
        if (!waist || !gender) return null;
        const waistCm = parseFloat(waist);
        
        let category: Result['category'];
        if (gender === 'Male') {
            if (waistCm < 94) category = 'Low Risk';
            else if (waistCm <= 102) category = 'Increased Risk';
            else category = 'High Risk';
        } else { // Female
            if (waistCm < 80) category = 'Low Risk';
            else if (waistCm <= 88) category = 'Increased Risk';
            else category = 'High Risk';
        }
        return { value: `${waistCm} cm`, category, message: `A ${gender.toLowerCase()} waist circumference of ${waistCm} cm is associated with a ${category.toLowerCase()}.` };
    };

    const calculateWtHR = (values: FormValues): Result | null => {
        const { waist, height } = values;
        if (!waist || !height) return null;
        const ratio = parseFloat(waist) / parseFloat(height);

        let category: Result['category'];
        if (ratio < 0.5) category = 'Low Risk';
        else if (ratio < 0.6) category = 'Increased Risk';
        else category = 'High Risk';

        return { value: ratio.toFixed(2), category, message: `A waist-to-height ratio of ${ratio.toFixed(2)} is considered ${category.toLowerCase()}. Keeping this ratio below 0.5 is ideal.` };
    };

    const calculateWHR = (values: FormValues): Result | null => {
        const { waist, hip, gender } = values;
        if (!waist || !hip || !gender) return null;
        const ratio = parseFloat(waist) / parseFloat(hip);

        let category: Result['category'];
        if (gender === 'Male') {
            if (ratio < 0.9) category = 'Low Risk';
            else if (ratio <= 1.0) category = 'Increased Risk';
            else category = 'High Risk';
        } else { // Female
            if (ratio < 0.85) category = 'Low Risk';
            else if (ratio <= 0.9) category = 'Increased Risk';
            else category = 'High Risk';
        }
        return { value: ratio.toFixed(2), category, message: `For a ${gender.toLowerCase()}, a waist-to-hip ratio of ${ratio.toFixed(2)} indicates a ${category.toLowerCase()}.` };
    };

    return (
        <div className="space-y-8">
            <Card>
                <CardHeader className="flex flex-row justify-between items-start">
                  <div>
                    <CardTitle className="flex items-center gap-2"><Ruler /> Body Metrics Calculators</CardTitle>
                    <CardDescription>Use these tools to assess health risks associated with body composition and fat distribution.</CardDescription>
                  </div>
                   <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="sm"><HelpCircle className="mr-2"/>What are these?</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Understanding Body Metrics</DialogTitle>
                        <DialogDescription>
                          These metrics provide insights into health risks related to body fat distribution.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="text-sm space-y-4">
                        <div>
                          <h4 className="font-bold">Waist Circumference</h4>
                          <p className="text-muted-foreground">A simple measure of abdominal fat. High values are linked to increased risk of type 2 diabetes and heart disease.</p>
                        </div>
                         <div>
                          <h4 className="font-bold">Waist-to-Height Ratio (WtHR)</h4>
                          <p className="text-muted-foreground">Compares waist to height. A ratio above 0.5 suggests increased health risks, even in people with a normal BMI.</p>
                        </div>
                         <div>
                          <h4 className="font-bold">Waist-to-Hip Ratio (WHR)</h4>
                          <p className="text-muted-foreground">Assesses fat distribution. A higher ratio (more "apple-shaped") indicates more fat around the abdomen, which is a key risk factor for various chronic diseases.</p>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </CardHeader>
                <CardContent>
                    <Tabs defaultValue="wthr">
                        <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3">
                            <TabsTrigger value="wthr">Waist-to-Height</TabsTrigger>
                            <TabsTrigger value="whr">Waist-to-Hip</TabsTrigger>
                            <TabsTrigger value="waist">Waist Circumference</TabsTrigger>
                        </TabsList>
                        <TabsContent value="wthr" className="pt-4">
                            <CalculatorTab
                                title="Waist-to-Height Ratio (WtHR)"
                                description="Compares your waist to your height. It's a simple yet effective indicator of health risks."
                                fields={['waist', 'height']}
                                calculate={calculateWtHR}
                            />
                        </TabsContent>
                        <TabsContent value="whr" className="pt-4">
                            <CalculatorTab
                                title="Waist-to-Hip Ratio (WHR)"
                                description="Compares your waist and hip measurements to assess fat distribution."
                                fields={['waist', 'hip', 'gender']}
                                calculate={calculateWHR}
                            />
                        </TabsContent>
                        <TabsContent value="waist" className="pt-4">
                            <CalculatorTab
                                title="Waist Circumference"
                                description="Directly measures abdominal fat, a key indicator of metabolic health risks."
                                fields={['waist', 'gender']}
                                calculate={calculateWaistCircumference}
                            />
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>

             <Alert className="border-accent bg-accent/10">
                <AlertTriangle className="h-4 w-4 text-accent-foreground" />
                <AlertTitle>For Informational Purposes Only</AlertTitle>
                <AlertDescription>
                    These calculators are general guides and are not a substitute for a professional medical diagnosis. Factors like body composition and muscle mass can influence results.
                </AlertDescription>
            </Alert>
        </div>
    );
}
