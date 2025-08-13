
"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Stethoscope, ShieldCheck, Zap, Bot, ArrowRight, MessageSquare, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import Image from 'next/image';
import { Input } from '../ui/input';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormMessage } from '../ui/form';
import { askLifeline, type AskLifelineOutput } from '@/ai/flows/lifeline-ai-flow';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';

const askSchema = z.object({
  question: z.string().min(10, { message: "Please ask a more detailed question." }),
});
type AskFormValues = z.infer<typeof askSchema>;

export function LandingPage() {
    const router = useRouter();
    const [aiResponse, setAiResponse] = useState<AskLifelineOutput | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    const form = useForm<AskFormValues>({
        resolver: zodResolver(askSchema),
        defaultValues: { question: "" },
    });

    const handleAuthRedirect = () => {
        router.push('/auth');
    };

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
        <div className="bg-background text-foreground font-sans antialiased">
            <div className="fixed inset-0 -z-10 h-full w-full bg-background bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,hsl(var(--primary)/0.1),rgba(255,255,255,0))]"></div>

            <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-sm">
                <div className="container mx-auto flex h-20 items-center justify-between px-4">
                    <Link href="/landing" className="flex items-center gap-2 text-primary">
                        <Stethoscope className="w-8 h-8" />
                        <h1 className="text-2xl font-bold">Lifeline AI</h1>
                    </Link>
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" asChild><Link href="/blog">Blog</Link></Button>
                        <Button onClick={handleAuthRedirect}>Get Started</Button>
                    </div>
                </div>
            </header>

            <main className="pt-20">
                {/* Hero Section */}
                <section className="relative py-32 md:py-48 text-center">
                    <div className="container mx-auto px-4">
                        <h1 className="text-4xl md:text-6xl font-extrabold mb-4 bg-clip-text text-transparent bg-gradient-to-br from-foreground to-muted-foreground tracking-tight">
                            Your Health, Empowered by AI
                        </h1>
                        <p className="max-w-2xl mx-auto text-lg md:text-xl text-muted-foreground mb-8">
                            Lifeline AI uses affordable test kits and powerful, personalized AI to detect early signs of deadly diseases. Take control of your health today.
                        </p>
                        <div className="flex justify-center gap-4">
                            <Button size="lg" onClick={handleAuthRedirect}>
                                 Start Your Health Journey <ArrowRight className="ml-2"/>
                            </Button>
                        </div>
                    </div>
                </section>

                {/* Features Section */}
                 <section className="py-20 bg-secondary/30">
                    <div className="container mx-auto px-4">
                        <div className="text-center mb-12">
                            <h2 className="text-3xl md:text-4xl font-bold">Why Lifeline AI?</h2>
                            <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">We are on a mission to make proactive healthcare accessible to everyone, everywhere.</p>
                        </div>
                        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
                            <FeatureCard icon={Zap} title="Early Detection" description="Identify risks for stroke, kidney failure, diabetes & more—before it's too late."/>
                            <FeatureCard icon={Bot} title="AI-Powered" description="Get instant, intelligent analysis of your results right on your phone."/>
                            <FeatureCard icon={ShieldCheck} title="Private & Secure" description="Your health data is yours. It's encrypted and protected with enterprise-grade security."/>
                            <FeatureCard icon={Stethoscope} title="Doctor Verified" description="AI insights are the start. Our plans are reviewed and approved by certified doctors."/>
                        </div>
                    </div>
                </section>

                {/* Ask Lifeline AI Section */}
                <section id="ask-ai" className="py-20">
                    <div className="container mx-auto px-4">
                        <div className="text-center mb-12">
                            <h2 className="text-3xl md:text-4xl font-bold">Have a Health Question?</h2>
                            <p className="text-muted-foreground mt-2">Ask our AI for general health information. This is not a diagnosis.</p>
                        </div>
                        <Card className="max-w-3xl mx-auto p-4 md:p-6 shadow-2xl shadow-primary/5 bg-card">
                            <CardContent className="p-0">
                                <Form {...form}>
                                    <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col sm:flex-row gap-4">
                                        <FormField control={form.control} name="question" render={({ field }) => (
                                            <FormItem className="flex-grow"><FormControl><Input placeholder="e.g., What are the early signs of dehydration?" {...field} className="h-12"/></FormControl><FormMessage className="pl-2"/></FormItem>
                                        )}/>
                                        <Button type="submit" size="lg" className="h-12" disabled={isLoading}>
                                            <MessageSquare className="mr-2"/> {isLoading ? 'Thinking...' : 'Ask Lifeline AI'}
                                        </Button>
                                    </form>
                                </Form>
                                {isLoading && <div className="flex justify-center p-8"><Loader2 className="w-12 h-12 animate-spin text-primary"/></div>}
                                {error && <p className="text-destructive text-center p-4">{error}</p>}
                                {aiResponse && (
                                    <div className="mt-8 p-4 md:p-6 bg-secondary/30 rounded-lg animate-in fade-in-50 duration-500">
                                        <div className="flex items-start gap-4">
                                            <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-full bg-primary/10 text-primary"><Bot /></div>
                                            <div className="flex-grow min-w-0"><h4 className="font-bold text-lg">Lifeline AI Says:</h4><p className="text-muted-foreground whitespace-pre-line break-words">{aiResponse.answer}</p></div>
                                        </div>
                                        {aiResponse.disclaimer && (<p className="text-xs text-muted-foreground/80 mt-6 pt-4 border-t border-muted/20"><strong>Disclaimer:</strong> {aiResponse.disclaimer}</p>)}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </section>
                
                {/* CTA Section */}
                <section className="py-20">
                    <div className="container mx-auto px-4 text-center">
                        <h2 className="text-3xl md:text-4xl font-bold">Ready to Take Control of Your Health?</h2>
                        <p className="text-muted-foreground mt-2 mb-8 max-w-2xl mx-auto">Download Lifeline AI today and join a community empowered by knowledge and early detection. Your future self will thank you.</p>
                        <Button size="lg" onClick={handleAuthRedirect}>
                             Sign Up for Free <ArrowRight className="ml-2"/>
                        </Button>
                    </div>
                </section>
            </main>

            <footer className="bg-card">
                <div className="container mx-auto px-4 py-8 text-center text-muted-foreground">
                    <p>&copy; {new Date().getFullYear()} Lifeline AI. All Rights Reserved.</p>
                    <p className="text-sm mt-2">Empowering proactive health for a better future.</p>
                </div>
            </footer>
        </div>
    );
}

const FeatureCard = ({ icon: Icon, title, description }: { icon: React.ElementType, title: string, description: string }) => (
    <Card className="text-center p-6 bg-card border-border hover:border-primary/50 transition-colors duration-300">
        <div className="w-12 h-12 mx-auto rounded-lg flex items-center justify-center bg-primary/10 text-primary mb-4">
            <Icon className="w-6 h-6"/>
        </div>
        <h3 className="text-xl font-bold">{title}</h3>
        <p className="text-muted-foreground">{description}</p>
    </Card>
);

    