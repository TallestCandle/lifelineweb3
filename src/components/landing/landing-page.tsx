
"use client";

import React, { useState, useEffect } from 'react';
import { Stethoscope, ShieldCheck, Zap, Bot, ArrowRight, MessageSquare, TestTube, ScanLine, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import Image from 'next/image';
import { Input } from '../ui/input';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormMessage } from '../ui/form';
import { askLifeline, type AskLifelineOutput } from '@/ai/flows/lifeline-ai-flow';
import { Loader } from '../ui/loader';
import Link from 'next/link';

const askSchema = z.object({
  question: z.string().min(10, { message: "Please ask a more detailed question." }),
});
type AskFormValues = z.infer<typeof askSchema>;

const partners = [
    { name: 'HealthPlus Initiative', logo: 'https://placehold.co/150x50.png', dataAiHint: 'logo health' },
    { name: 'Rural Health Foundation', logo: 'https://placehold.co/150x50.png', dataAiHint: 'logo foundation' },
    { name: 'TechForGood NG', logo: 'https://placehold.co/150x50.png', dataAiHint: 'logo tech' },
    { name: 'Innovate Africa', logo: 'https://placehold.co/150x50.png', dataAiHint: 'logo innovate' },
];

export function LandingPage() {
    const [aiResponse, setAiResponse] = useState<AskLifelineOutput | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    const form = useForm<AskFormValues>({
        resolver: zodResolver(askSchema),
        defaultValues: { question: "" },
    });

    const onSubmit = async (data: AskFormValues) => {
        setIsLoading(true);
        setAiResponse(null);
        setError(null);
        try {
            const result = await askLifeline({ query: data.question });
            setAiResponse(result);
        } catch (err) {
            console.error(err);
            setError("Sorry, I couldn't process that question. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };
  
    return (
        <div className="bg-background text-foreground font-body antialiased animated-gradient-bg">
            <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-sm">
                <div className="container mx-auto flex h-20 items-center justify-between px-4">
                    <Link href="/landing" className="flex items-center gap-2 text-primary">
                        <Stethoscope className="w-8 h-8" />
                        <h1 className="text-2xl font-bold font-headline">Lifeline AI</h1>
                    </Link>
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" asChild><Link href="/auth">Log In</Link></Button>
                        <Button asChild><Link href="/auth">Get Started</Link></Button>
                    </div>
                </div>
            </header>

            <main className="pt-20">
                {/* Hero Section */}
                <section className="relative container mx-auto px-4 py-20 md:py-32 text-center overflow-hidden">
                    <div className="absolute -inset-20 -z-10 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,hsl(var(--primary)/0.2),transparent)]" />
                    <h1 className="text-4xl md:text-6xl font-bold font-headline mb-4 animated-text-shine">
                        Early Disease Detection, For Everyone.
                    </h1>
                    <p className="max-w-3xl mx-auto text-lg md:text-xl text-muted-foreground mb-8">
                        Lifeline AI uses affordable test kits and powerful AI to put control of your health back in your hands. Detect early signs of kidney failure, stroke, diabetes, and infections—affordably and instantly.
                    </p>
                    <div className="flex justify-center gap-4">
                        <Button size="lg" asChild>
                           <Link href="/auth">
                             Get Your Free Health Check <ArrowRight />
                           </Link>
                        </Button>
                    </div>
                </section>

                {/* How It Works Section */}
                <section className="py-20 bg-secondary/30">
                    <div className="container mx-auto px-4">
                        <div className="text-center mb-12">
                            <h2 className="text-3xl md:text-4xl font-bold font-headline">Your Health Journey in 3 Simple Steps</h2>
                            <p className="text-muted-foreground mt-2">Accessible, fast, and life-changing results.</p>
                        </div>
                        <div className="grid md:grid-cols-3 gap-8 text-center">
                            <div className="bg-card/50 p-8 rounded-lg border border-primary/20 shadow-lg">
                                <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                                    <TestTube className="w-8 h-8"/>
                                </div>
                                <h3 className="text-xl font-bold mb-2">1. Test at Home</h3>
                                <p className="text-muted-foreground">Use our simple, low-cost urine test kits. No clinics, no appointments needed.</p>
                            </div>
                            <div className="bg-card/50 p-8 rounded-lg border border-primary/20 shadow-lg">
                                <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                                    <ScanLine className="w-8 h-8"/>
                                </div>
                                <h3 className="text-xl font-bold mb-2">2. Scan with App</h3>
                                <p className="text-muted-foreground">Take a picture of the test strip with your phone using the Lifeline AI app.</p>
                            </div>
                            <div className="bg-card/50 p-8 rounded-lg border border-primary/20 shadow-lg">
                                <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                                    <Sparkles className="w-8 h-8"/>
                                </div>
                                <h3 className="text-xl font-bold mb-2">3. Get AI Insights</h3>
                                <p className="text-muted-foreground">Our AI instantly analyzes the results, identifies risks, and gives you clear, actionable advice.</p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Ask Lifeline AI Section */}
                <section id="ask-ai" className="py-20">
                    <div className="container mx-auto px-4">
                        <div className="text-center mb-12">
                            <h2 className="text-3xl md:text-4xl font-bold font-headline">Have a Health Question?</h2>
                            <p className="text-muted-foreground mt-2">Ask our AI for general health information. Try it now.</p>
                        </div>
                        <Card className="max-w-3xl mx-auto p-4 md:p-6 shadow-2xl shadow-primary/10">
                            <CardContent className="p-0">
                                <Form {...form}>
                                    <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col sm:flex-row gap-4">
                                        <FormField
                                            control={form.control}
                                            name="question"
                                            render={({ field }) => (
                                                <FormItem className="flex-grow">
                                                    <FormControl>
                                                        <Input placeholder="e.g., What are the early signs of dehydration?" {...field} className="h-12"/>
                                                    </FormControl>
                                                    <FormMessage className="pl-2"/>
                                                </FormItem>
                                            )}
                                        />
                                        <Button type="submit" size="lg" className="h-12" disabled={isLoading}>
                                            <MessageSquare className="mr-2"/> Ask Lifeline AI
                                        </Button>
                                    </form>
                                </Form>
                                {isLoading && <div className="flex justify-center p-8"><Loader className="w-12 h-12"/></div>}
                                {error && <p className="text-destructive text-center p-4">{error}</p>}
                                {aiResponse && (
                                    <div className="mt-8 p-4 md:p-6 bg-secondary/30 rounded-lg animate-in fade-in-50 duration-500">
                                        <div className="flex items-start gap-4">
                                            <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-full bg-primary/10 text-primary">
                                                <Bot />
                                            </div>
                                            <div className="flex-grow min-w-0">
                                                <h4 className="font-bold text-lg">Lifeline AI Says:</h4>
                                                <p className="text-muted-foreground whitespace-pre-line break-words">
                                                    {aiResponse.answer}
                                                </p>
                                            </div>
                                        </div>
                                        {aiResponse.disclaimer && (
                                            <p className="text-xs text-muted-foreground/80 mt-6 pt-4 border-t border-muted/20">
                                                <strong>Disclaimer:</strong> {aiResponse.disclaimer}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </section>

                {/* Partners Section */}
                <section className="py-20 bg-secondary/30">
                    <div className="container mx-auto px-4">
                        <h2 className="text-center text-xl font-bold text-muted-foreground mb-8">Trusted by our partners in health innovation</h2>
                        <div className="flex flex-wrap items-center justify-center gap-8 md:gap-16">
                            {partners.map(p => (
                                <Image key={p.name} src={p.logo} alt={p.name} width={150} height={50} className="opacity-60 hover:opacity-100 transition-opacity" data-ai-hint={p.dataAiHint}/>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Testimonials */}
                <section className="py-20">
                    <div className="container mx-auto px-4">
                        <div className="text-center mb-12">
                            <h2 className="text-3xl md:text-4xl font-bold font-headline">Saving Lives, One Test at a Time</h2>
                        </div>
                        <div className="grid md:grid-cols-2 gap-8">
                            <Card className="p-6">
                                <CardContent className="p-0">
                                    <blockquote className="text-lg">"The app detected high protein in my urine, which I ignored. The AI insisted I see a doctor. It was early kidney disease. Lifeline AI saved my life."</blockquote>
                                    <footer className="mt-4 font-bold">- Fatima, Kaduna State</footer>
                                </CardContent>
                            </Card>
                            <Card className="p-6">
                                <CardContent className="p-0">
                                    <blockquote className="text-lg">"As a community health worker, this app is a game-changer. I can screen dozens of people in a day and get instant risk analysis. It's helping us reach so many more people."</blockquote>
                                    <footer className="mt-4 font-bold">- David, Oyo State</footer>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </section>
                
                {/* CTA Section */}
                <section className="py-20">
                    <div className="container mx-auto px-4 text-center">
                        <h2 className="text-3xl md:text-4xl font-bold font-headline">Ready to Take Control of Your Health?</h2>
                        <p className="text-muted-foreground mt-2 mb-8 max-w-2xl mx-auto">Download Lifeline AI today and join a community empowered by knowledge and early detection. Your future self will thank you.</p>
                        <Button size="lg" asChild>
                           <Link href="/auth">
                             Download The App & Get Started <ArrowRight />
                           </Link>
                        </Button>
                    </div>
                </section>
            </main>

            <footer className="bg-secondary/30">
                <div className="container mx-auto px-4 py-8 text-center text-muted-foreground">
                    <p>&copy; {new Date().getFullYear()} Lifeline AI. All Rights Reserved.</p>
                    <p className="text-sm mt-2">Empowering proactive health for a better future.</p>
                </div>
            </footer>
        </div>
    );
}
