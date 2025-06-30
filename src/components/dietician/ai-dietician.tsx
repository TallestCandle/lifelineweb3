"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader } from '@/components/ui/loader';
import { useAuth } from '@/context/auth-provider';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, doc, getDoc, setDoc, query, orderBy, limit, getDocs, where } from 'firebase/firestore';
import { format, subDays } from 'date-fns';
import { generateDietPlan, type GenerateDietPlanOutput } from '@/ai/flows/generate-diet-plan-flow';
import { CookingPot, Sunrise, Sun, Moon, Sparkles, AlertTriangle, Lightbulb } from 'lucide-react';

export function AiDietician() {
    const { user } = useAuth();
    const { toast } = useToast();
    
    const [isClient, setIsClient] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [dietPlan, setDietPlan] = useState<GenerateDietPlanOutput | null>(null);

    useEffect(() => {
        setIsClient(true);
    }, []);

    const fetchTodaysPlan = useCallback(async () => {
        if (!user) return;
        
        setIsLoading(true);
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        const planDocRef = doc(db, `users/${user.uid}/daily_diet_plans`, todayStr);
        
        try {
            const docSnap = await getDoc(planDocRef);
            if (docSnap.exists()) {
                setDietPlan(docSnap.data() as GenerateDietPlanOutput);
            } else {
                setDietPlan(null); // No plan generated for today yet
            }
        } catch (error) {
            console.error("Error fetching today's diet plan:", error);
            toast({ variant: 'destructive', title: "Error", description: "Could not fetch today's plan." });
        } finally {
            setIsLoading(false);
        }
    }, [user, toast]);

    useEffect(() => {
        if (isClient) {
            fetchTodaysPlan();
        }
    }, [isClient, fetchTodaysPlan]);

    const handleGeneratePlan = async () => {
        if (!user) return;

        setIsLoading(true);
        setDietPlan(null);

        try {
            // Fetch recent health data
            const sevenDaysAgo = subDays(new Date(), 7).toISOString();
            const basePath = `users/${user.uid}`;
            const vitalsCol = collection(db, `${basePath}/vitals`);
            const stripsCol = collection(db, `${basePath}/test_strips`);
            const analysesCol = collection(db, `${basePath}/health_analyses`);

            const [vitalsSnap, stripsSnap, analysesSnap] = await Promise.all([
                getDocs(query(vitalsCol, where('date', '>=', sevenDaysAgo), orderBy('date', 'desc'), limit(20))),
                getDocs(query(stripsCol, where('date', '>=', sevenDaysAgo), orderBy('date', 'desc'), limit(20))),
                getDocs(query(analysesCol, where('timestamp', '>=', sevenDaysAgo), orderBy('timestamp', 'desc'), limit(10))),
            ]);

            const healthSummary = JSON.stringify({
                vitals: vitalsSnap.docs.map(d => d.data()),
                strips: stripsSnap.docs.map(d => d.data()),
                analyses: analysesSnap.docs.map(d => d.data().analysisResult),
            });

            if (vitalsSnap.empty && stripsSnap.empty && analysesSnap.empty) {
                toast({ variant: 'destructive', title: "Not Enough Data", description: "Please log some vitals or test results before generating a plan." });
                setIsLoading(false);
                return;
            }

            const result = await generateDietPlan({
                healthSummary,
            });

            // Save the plan for today
            const todayStr = format(new Date(), 'yyyy-MM-dd');
            const planDocRef = doc(db, `users/${user.uid}/daily_diet_plans`, todayStr);
            await setDoc(planDocRef, result);

            setDietPlan(result);

        } catch (error) {
            console.error("Failed to generate AI diet plan:", error);
            toast({ variant: 'destructive', title: "AI Error", description: "Could not generate a diet plan. Please try again." });
        } finally {
            setIsLoading(false);
        }
    };

    if (!isClient) return null;

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-3">
                        <CookingPot className="w-8 h-8 text-primary" />
                        <span className="text-2xl">AI-Powered Dietician</span>
                    </CardTitle>
                    <CardDescription>
                        Get a personalized daily meal plan based on your recent health data.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {!dietPlan && !isLoading && (
                        <div className="flex flex-col items-center justify-center text-center p-8 bg-secondary rounded-lg">
                            <h3 className="text-lg font-bold">No plan for today yet.</h3>
                            <p className="text-muted-foreground mb-4">Click the button to have our AI create one for you.</p>
                            <Button onClick={handleGeneratePlan} disabled={isLoading}>
                                <Sparkles className="mr-2 h-4 w-4" />
                                Generate Today's Plan
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>
            
            {isLoading && (
                 <div className="flex flex-col items-center justify-center h-64 gap-4">
                    <Loader />
                    <p className="text-muted-foreground">Our AI Dietician is crafting your personalized plan...</p>
                </div>
            )}

            {dietPlan && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <Card>
                            <CardHeader className="flex-row items-center gap-3 space-y-0">
                                <Sunrise className="w-6 h-6 text-orange-400" />
                                <CardTitle>Breakfast</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="font-bold text-lg">{dietPlan.breakfast.meal}</p>
                                <p className="text-sm text-muted-foreground mt-1">{dietPlan.breakfast.reason}</p>
                            </CardContent>
                        </Card>
                         <Card>
                            <CardHeader className="flex-row items-center gap-3 space-y-0">
                                <Sun className="w-6 h-6 text-yellow-400" />
                                <CardTitle>Lunch</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="font-bold text-lg">{dietPlan.lunch.meal}</p>
                                <p className="text-sm text-muted-foreground mt-1">{dietPlan.lunch.reason}</p>
                            </CardContent>
                        </Card>
                         <Card>
                            <CardHeader className="flex-row items-center gap-3 space-y-0">
                                <Moon className="w-6 h-6 text-indigo-400" />
                                <CardTitle>Dinner</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="font-bold text-lg">{dietPlan.dinner.meal}</p>
                                <p className="text-sm text-muted-foreground mt-1">{dietPlan.dinner.reason}</p>
                            </CardContent>
                        </Card>
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-3">
                                <Lightbulb className="w-6 h-6 text-primary" />
                                General Dietary Advice
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                             <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                                {dietPlan.generalAdvice.map((advice, index) => <li key={index}>{advice}</li>)}
                            </ul>
                        </CardContent>
                    </Card>
                    
                    <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Disclaimer</AlertTitle>
                        <AlertDescription>
                            This is an AI-generated dietary suggestion and not medical advice. Consult with a healthcare professional or registered dietician before making significant changes to your diet.
                        </AlertDescription>
                    </Alert>

                     <div className="text-center">
                        <Button onClick={handleGeneratePlan} variant="outline" disabled={isLoading}>
                             <Sparkles className="mr-2 h-4 w-4" />
                             Regenerate Plan
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
