
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Sparkles, AlertTriangle, Lightbulb, ThumbsDown, ThumbsUp, CookingPot, Send, Camera, Trash2, History, HelpCircle, Check, ShieldBan, ShieldCheck } from 'lucide-react';
import { Progress } from "@/components/ui/progress";
import { useAuth } from '@/context/auth-provider';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, doc, setDoc, query, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { analyzeMeal, type AnalyzeMealOutput } from '@/ai/flows/analyze-meal-flow';
import { checkFoodSuitability, type CheckFoodSuitabilityOutput } from '@/ai/flows/check-food-suitability-flow';
import { Textarea } from '../ui/textarea';
import { Input } from '../ui/input';
import Image from 'next/image';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../ui/accordion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from '@/lib/utils';

interface MealLog {
    id: string;
    timestamp: string;
    mealDescription: string;
    healthConditions: string;
    analysis: AnalyzeMealOutput;
    imageDataUri?: string;
}

const MealAnalyzer = () => {
    const { user } = useAuth();
    const { toast } = useToast();
    
    const [isLoading, setIsLoading] = useState(false);
    const [mealDescription, setMealDescription] = useState('');
    const [healthConditions, setHealthConditions] = useState('');
    const [imageDataUri, setImageDataUri] = useState<string | null>(null);
    const [analysisResult, setAnalysisResult] = useState<AnalyzeMealOutput | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => setImageDataUri(reader.result as string);
            reader.readAsDataURL(file);
        }
    };

    const handleAnalyzeMeal = async () => {
        if (!user) {
            toast({ variant: "destructive", title: "User profile not loaded." });
            return;
        }
        if (mealDescription.length < 10) {
            toast({ variant: "destructive", title: "Please describe your meal in more detail." });
            return;
        }
        if (healthConditions.length < 3) {
            toast({ variant: "destructive", title: "Please state your health condition(s)." });
            return;
        }

        setIsLoading(true);
        setAnalysisResult(null);

        try {
            const result = await analyzeMeal({
                mealDescription,
                healthConditions,
                imageDataUri: imageDataUri || undefined,
            });

            setAnalysisResult(result);
            
            const timestamp = new Date().toISOString();
            const logEntry: Omit<MealLog, 'id'> = {
                timestamp,
                mealDescription,
                healthConditions,
                analysis: result,
            };
            if (imageDataUri) {
                logEntry.imageDataUri = imageDataUri;
            }
            
            await setDoc(doc(db, `users/${user.uid}/meal_logs`, timestamp), logEntry);
            toast({ title: "Meal Analyzed & Logged!" });

        } catch (error) {
            console.error("Failed to analyze meal:", error);
            toast({ variant: 'destructive', title: "AI Error", description: "Could not analyze your meal. Please try again." });
        } finally {
            setIsLoading(false);
        }
    };
    
    const resetForm = () => {
        setMealDescription('');
        setHealthConditions('');
        setImageDataUri(null);
        setAnalysisResult(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-3">
                        <CookingPot className="w-8 h-8 text-primary" />
                        <span className="text-2xl">Full Meal Analysis</span>
                    </CardTitle>
                    <CardDescription>
                        Log a complete meal to get a detailed breakdown and health score.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <label htmlFor="health-conditions-meal" className="font-bold">What is your health condition?</label>
                        <Input
                            id="health-conditions-meal"
                            placeholder="e.g., Chronic Kidney Disease, Diabetes, Hypertension"
                            value={healthConditions}
                            onChange={(e) => setHealthConditions(e.target.value)}
                            className="mt-2"
                        />
                    </div>
                    <div>
                        <label htmlFor="meal-description" className="font-bold">Describe your meal</label>
                        <Textarea
                            id="meal-description"
                            placeholder="e.g., A plate of jollof rice with fried chicken and a side of plantain."
                            value={mealDescription}
                            onChange={(e) => setMealDescription(e.target.value)}
                            rows={3}
                            className="mt-2"
                        />
                    </div>
                    <div className="flex flex-col sm:flex-row items-center gap-4">
                        <Button variant="outline" className="w-full sm:w-auto" onClick={() => fileInputRef.current?.click()}>
                            <Camera className="mr-2 h-4 w-4" />
                            Add Photo (Optional)
                        </Button>
                        <Input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                        {imageDataUri && (
                            <div className="relative w-fit">
                            <Image src={imageDataUri} alt="Preview" width={60} height={60} className="rounded-md border" />
                            <Button variant="destructive" size="icon" className="absolute -top-2 -right-2 rounded-full h-6 w-6" onClick={() => setImageDataUri(null)}><Trash2 className="h-4 w-4" /></Button>
                            </div>
                        )}
                    </div>
                </CardContent>
                <CardFooter>
                    <Button onClick={handleAnalyzeMeal} disabled={isLoading} className="w-full">
                        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                        Analyze My Meal
                    </Button>
                </CardFooter>
            </Card>

            {analysisResult && (
                <Card className="border-primary/30">
                    <CardHeader>
                        <div className="flex justify-between items-start">
                            <div>
                                <CardTitle>AI Analysis Result</CardTitle>
                                <CardDescription>{analysisResult.overallAssessment}</CardDescription>
                            </div>
                            <Button variant="ghost" onClick={resetForm}>Start New Log</Button>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <p className="text-sm font-bold">Health Score</p>
                                <p className="font-bold text-lg text-primary">{analysisResult.healthScore}/100</p>
                            </div>
                            <Progress value={analysisResult.healthScore} />
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {analysisResult.mainComponents.map((item, index) => (
                                <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-secondary/50">
                                    {item.isHealthy ? <ThumbsUp className="w-5 h-5 text-green-500 mt-1 flex-shrink-0" /> : <ThumbsDown className="w-5 h-5 text-red-500 mt-1 flex-shrink-0" />}
                                    <div>
                                        <p className="font-bold">{item.name}</p>
                                        <p className="text-xs text-muted-foreground">{item.reason}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                        
                        <Alert>
                            <Lightbulb className="h-4 w-4" />
                            <AlertTitle>Healthier Alternative</AlertTitle>
                            <AlertDescription>{analysisResult.healthierAlternative}</AlertDescription>
                        </Alert>
                        <Alert variant="default" className="border-accent bg-accent/10">
                            <AlertTriangle className="h-4 w-4 text-accent-foreground" />
                            <AlertTitle>Pro Tips</AlertTitle>
                            <AlertDescription>
                                <ul className="list-disc list-inside mt-1">
                                    {analysisResult.healthTips.map((tip, index) => <li key={index}>{tip}</li>)}
                                </ul>
                            </AlertDescription>
                        </Alert>
                    </CardContent>
                </Card>
            )}
        </div>
    );
};

const FoodChecker = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [healthCondition, setHealthCondition] = useState('');
    const [foodQuery, setFoodQuery] = useState('');
    const [checkResult, setCheckResult] = useState<CheckFoodSuitabilityOutput | null>(null);
    const { toast } = useToast();

    const suitabilityConfig = {
        'Yes': { color: 'text-green-500', icon: ShieldCheck, text: 'Considered Safe' },
        'In Moderation': { color: 'text-yellow-500', icon: AlertTriangle, text: 'Use With Caution' },
        'No': { color: 'text-red-500', icon: ShieldBan, text: 'Not Recommended' },
    };

    const handleCheckFood = async () => {
        if (!foodQuery.trim() || !healthCondition.trim()) {
            toast({ variant: "destructive", title: "All fields are required." });
            return;
        }
        setIsLoading(true);
        setCheckResult(null);

        try {
            const result = await checkFoodSuitability({
                foodQuery,
                healthCondition,
            });
            setCheckResult(result);
        } catch (error) {
            console.error("Failed to check food:", error);
            toast({ variant: 'destructive', title: "AI Error", description: "Could not check this food item. Please try again." });
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-3">
                        <HelpCircle className="w-8 h-8 text-primary" />
                        <span className="text-2xl">Quick Food Check</span>
                    </CardTitle>
                    <CardDescription>
                        Ask if a specific food is okay for your health condition.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                     <div>
                        <label htmlFor="health-condition-check" className="font-bold">Your health condition</label>
                        <Input
                            id="health-condition-check"
                            placeholder="e.g., CKD Stage 4"
                            value={healthCondition}
                            onChange={(e) => setHealthCondition(e.target.value)}
                            className="mt-2"
                        />
                    </div>
                     <div>
                        <label htmlFor="food-query" className="font-bold">Food item or question</label>
                        <Input
                            id="food-query"
                            placeholder="e.g., Onions, avocado, watermelon"
                            value={foodQuery}
                            onChange={(e) => setFoodQuery(e.target.value)}
                            className="mt-2"
                        />
                    </div>
                </CardContent>
                <CardFooter>
                    <Button onClick={handleCheckFood} disabled={isLoading} className="w-full">
                        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                        Check Food
                    </Button>
                </CardFooter>
            </Card>

            {checkResult && (
                <Card className="border-primary/30">
                    <CardHeader>
                         <CardTitle>AI Suitability Check</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Alert className={cn("border-2", suitabilityConfig[checkResult.isSuitable].color.replace('text-', 'border-'))}>
                            <suitabilityConfig[checkResult.isSuitable].icon className={cn("h-4 w-4", suitabilityConfig[checkResult.isSuitable].color)} />
                            <AlertTitle className={cn(suitabilityConfig[checkResult.isSuitable].color)}>
                                {suitabilityConfig[checkResult.isSuitable].text}
                            </AlertTitle>
                            <AlertDescription>
                                {checkResult.explanation}
                            </AlertDescription>
                        </Alert>

                        {checkResult.contextualTips.length > 0 && (
                             <Alert variant="default" className="border-accent bg-accent/10">
                                <AlertTriangle className="h-4 w-4 text-accent-foreground" />
                                <AlertTitle>Important Tips</AlertTitle>
                                <AlertDescription>
                                    <ul className="list-disc list-inside mt-1">
                                        {checkResult.contextualTips.map((tip, index) => <li key={index}>{tip}</li>)}
                                    </ul>
                                </AlertDescription>
                            </Alert>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    );
};


export function AiMealAnalyzer() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [mealHistory, setMealHistory] = useState<MealLog[]>([]);
    const [isHistoryLoading, setIsHistoryLoading] = useState(true);
    
    useEffect(() => {
        if (!user) {
            setIsHistoryLoading(false);
            return;
        }

        const historyQuery = query(collection(db, `users/${user.uid}/meal_logs`), orderBy('timestamp', 'desc'), limit(20));
        const unsubscribe = onSnapshot(historyQuery, (snapshot) => {
            const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MealLog));
            setMealHistory(logs);
            setIsHistoryLoading(false);
        }, (error) => {
            console.error("Error fetching meal history:", error);
            toast({ variant: 'destructive', title: "Error", description: "Could not fetch meal history." });
            setIsHistoryLoading(false);
        });

        return () => unsubscribe();
    }, [user, toast]);

    return (
        <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
                 <Tabs defaultValue="analyze" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="analyze">Analyze Meal</TabsTrigger>
                        <TabsTrigger value="check">Check Food</TabsTrigger>
                    </TabsList>
                    <TabsContent value="analyze" className="mt-6">
                        <MealAnalyzer />
                    </TabsContent>
                    <TabsContent value="check" className="mt-6">
                        <FoodChecker />
                    </TabsContent>
                </Tabs>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><History/> Meal Log History</CardTitle>
                    <CardDescription>Your recently analyzed meals.</CardDescription>
                </CardHeader>
                <CardContent>
                    {isHistoryLoading ? (
                        <div className="flex justify-center p-8"><Loader2 className="animate-spin"/></div>
                    ) : mealHistory.length > 0 ? (
                        <Accordion type="single" collapsible className="w-full">
                            {mealHistory.map(log => (
                                <AccordionItem value={log.id} key={log.id}>
                                    <AccordionTrigger>
                                        <div className="flex justify-between items-center w-full pr-4">
                                            <div className="flex-grow text-left">
                                                <p className="font-bold truncate max-w-[200px]">{log.mealDescription}</p>
                                                <p className="text-xs text-muted-foreground">{formatDistanceToNow(parseISO(log.timestamp), { addSuffix: true })}</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Progress value={log.analysis.healthScore} className="w-16 h-2 hidden sm:block"/>
                                                <span className="font-bold text-sm text-primary">{log.analysis.healthScore}</span>
                                            </div>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="space-y-4">
                                        {log.imageDataUri && <Image src={log.imageDataUri} alt="Logged meal" width={100} height={100} className="rounded-md border"/>}
                                        <p className="text-sm italic text-muted-foreground">{log.analysis.overallAssessment}</p>
                                        <p className="text-sm"><span className="font-bold">Conditions at time of log:</span> {log.healthConditions}</p>
                                        <ul className="space-y-2">
                                            {log.analysis.mainComponents.map((item, index) => (
                                                <li key={index} className="flex items-start gap-2 text-xs">
                                                    {item.isHealthy ? <ThumbsUp className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" /> : <ThumbsDown className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />}
                                                    <p><span className="font-bold">{item.name}:</span> {item.reason}</p>
                                                </li>
                                            ))}
                                        </ul>
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                        </Accordion>
                    ) : (
                        <p className="text-center text-muted-foreground py-8">No meals logged yet.</p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
