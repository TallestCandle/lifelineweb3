
"use client";

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { AnimatePresence, motion } from 'framer-motion';

import { useAuth } from '@/context/auth-provider';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, addDoc } from 'firebase/firestore';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { ArrowLeft, Loader2, Ruler, Weight, Waves } from 'lucide-react';

const bmiSchema = z.object({
  height: z.string().min(1, "Required"),
  weight: z.string().min(1, "Required"),
});

const whrSchema = z.object({
  waist: z.string().min(1, "Required"),
  hip: z.string().min(1, "Required"),
});

const wthrSchema = z.object({
    waist: z.string().min(1, "Required"),
    height: z.string().min(1, "Required"),
});


type MetricType = 'bmi' | 'whr' | 'wthr';

const metricOptions: { type: MetricType, title: string, icon: React.ElementType, schema: any, fields: string[] }[] = [
    { type: 'bmi', title: 'Body Mass Index', icon: Weight, schema: bmiSchema, fields: ['height', 'weight'] },
    { type: 'whr', title: 'Waist-Hip Ratio', icon: Ruler, schema: whrSchema, fields: ['waist', 'hip'] },
    { type: 'wthr', title: 'Waist-Height Ratio', icon: Waves, schema: wthrSchema, fields: ['waist', 'height'] },
];


export function BodyMetricsLogger() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [activeForm, setActiveForm] = useState<typeof metricOptions[number] | null>(null);

     const form = useForm({
        resolver: activeForm ? zodResolver(activeForm.schema) : undefined,
        defaultValues: {
            height: "",
            weight: "",
            waist: "",
            hip: "",
        },
    });

    useEffect(() => {
        if (activeForm) {
            form.reset();
        }
    }, [activeForm, form]);

    const handleSave = async (data: any) => {
        if (!user || !activeForm) return;

        const date = new Date().toISOString();
        const collectionRef = collection(db, `users/${user.uid}/body_metrics`);

        const values: any = {};
        activeForm.fields.forEach(field => {
            values[field] = parseFloat(data[field]);
        });
        
        if (activeForm.type === 'bmi') {
            const heightM = values.height / 100;
            values.bmi = parseFloat((values.weight / (heightM * heightM)).toFixed(1));
        }
        if (activeForm.type === 'whr') {
            values.whr = parseFloat((values.waist / values.hip).toFixed(2));
        }
        if (activeForm.type === 'wthr') {
            values.wthr = parseFloat((values.waist / values.height).toFixed(2));
        }

        try {
            await addDoc(collectionRef, { type: activeForm.type, date, values });
            toast({ title: 'Data Saved', description: `${activeForm.title} has been logged.` });
            setActiveForm(null);
        } catch (error) {
            console.error("Error saving data:", error);
            toast({ variant: 'destructive', title: 'Save Failed', description: 'Could not save the data.' });
        }
    };

    const renderFormFields = () => {
        if (!activeForm) return null;

        switch (activeForm.type) {
            case 'bmi':
                return <>
                    <FormField control={form.control} name="height" render={({ field }) => (<FormItem><FormLabel>Height (cm)</FormLabel><FormControl><Input placeholder="175" type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="weight" render={({ field }) => (<FormItem><FormLabel>Weight (kg)</FormLabel><FormControl><Input placeholder="70" type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                </>;
            case 'whr':
                return <>
                    <FormField control={form.control} name="waist" render={({ field }) => (<FormItem><FormLabel>Waist (cm)</FormLabel><FormControl><Input placeholder="80" type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="hip" render={({ field }) => (<FormItem><FormLabel>Hip (cm)</FormLabel><FormControl><Input placeholder="95" type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                </>;
            case 'wthr':
                 return <>
                    <FormField control={form.control} name="waist" render={({ field }) => (<FormItem><FormLabel>Waist (cm)</FormLabel><FormControl><Input placeholder="80" type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="height" render={({ field }) => (<FormItem><FormLabel>Height (cm)</FormLabel><FormControl><Input placeholder="175" type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                </>;
            default: return null;
        }
    };
    
    return (
        <Card className="overflow-hidden">
             <AnimatePresence mode="wait">
                {!activeForm ? (
                    <motion.div key="selection" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                         <CardContent className="p-6">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                {metricOptions.map((opt) => (
                                    <button key={opt.type} onClick={() => setActiveForm(opt)} className="group flex flex-col items-center justify-center p-4 aspect-square rounded-lg bg-secondary/50 hover:bg-secondary transition-all">
                                        <opt.icon className="w-10 h-10 text-primary mb-2 transition-transform group-hover:scale-110" />
                                        <p className="font-bold text-sm text-center">{opt.title}</p>
                                    </button>
                                ))}
                            </div>
                        </CardContent>
                    </motion.div>
                ) : (
                    <motion.div key="form" initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ ease: "easeInOut", duration: 0.3 }}>
                        <CardContent className="p-6">
                            <div className="flex items-center gap-4 mb-4">
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setActiveForm(null)}><ArrowLeft/></Button>
                                <h3 className="text-lg font-bold">Log {activeForm.title}</h3>
                            </div>
                             <Form {...form}>
                                <form onSubmit={form.handleSubmit(handleSave)} className="space-y-4">
                                    {renderFormFields()}
                                    <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                                        {form.formState.isSubmitting ? <Loader2 className="animate-spin mr-2"/> : null}
                                        Save Log
                                    </Button>
                                </form>
                            </Form>
                        </CardContent>
                    </motion.div>
                )}
            </AnimatePresence>
        </Card>
    );
}
