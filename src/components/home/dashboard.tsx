
"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import {
  HeartPulse,
  BrainCircuit,
  FileText,
  Salad,
  Search,
  ArrowRight
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/auth-provider';
import { useToast } from '@/hooks/use-toast';
import {
  performComprehensiveAnalysis,
  type ComprehensiveAnalysisInput,
  type ComprehensiveAnalysisOutput,
} from '@/ai/flows/comprehensive-analysis-flow';
import { db } from '@/lib/firebase';
import { collection, query, getDocs, orderBy, limit } from 'firebase/firestore';

import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Loader2, Lightbulb, Zap } from 'lucide-react';

interface DashboardCardProps {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
  color: string;
}

const mainFeatures: DashboardCardProps[] = [
  {
    href: "/vitals",
    icon: HeartPulse,
    title: "Log Vitals",
    description: "Track BP, sugar, temp & more.",
    color: "text-red-400",
  },
  {
    href: "/analysis",
    icon: BrainCircuit,
    title: "AI Snapshot",
    description: "Get an instant analysis of your health.",
    color: "text-blue-400",
  },
  {
    href: "/dietician",
    icon: Salad,
    title: "AI Dietician",
    description: "Personalized meal plans for you.",
    color: "text-green-400",
  },
  {
    href: "/report",
    icon: FileText,
    title: "Monthly Report",
    description: "Review your detailed health summary.",
    color: "text-purple-400",
  },
];

const UrgencyConfig: Record<string, { color: string; text: string }> = {
    'Mild': { color: 'bg-yellow-400', text: 'Mild' },
    'Moderate': { color: 'bg-orange-500', text: 'Moderate' },
    'Critical': { color: 'bg-red-600', text: 'Critical' },
};

const DashboardCard: React.FC<DashboardCardProps> = ({ href, icon: Icon, title, description, color }) => (
  <Link href={href} className="group block">
    <Card className="h-full transition-all duration-300 hover:border-primary/50 hover:-translate-y-1 hover:shadow-2xl hover:shadow-primary/10">
      <CardHeader>
        <Icon className={cn("w-8 h-8 mb-2", color)} />
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
    </Card>
  </Link>
);


export function Dashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<ComprehensiveAnalysisOutput | null>(null);
  const [showResultDialog, setShowResultDialog] = useState(false);
  
  const firstName = user?.displayName?.split(' ')[0] || 'User';

  const handleDeepAnalysis = async () => {
    if (!user) {
        toast({ variant: 'destructive', title: 'Error', description: 'No user found.' });
        return;
    }
    setIsAnalyzing(true);
    setAnalysisResult(null);

    try {
        const basePath = `users/${user.uid}`;
        
        const [vitalsSnap, stripsSnap, analysesSnap] = await Promise.all([
            getDocs(query(collection(db, `${basePath}/vitals`), orderBy('date', 'desc'), limit(100))),
            getDocs(query(collection(db, `${basePath}/test_strips`), orderBy('date', 'desc'), limit(100))),
            getDocs(query(collection(db, `${basePath}/health_analyses`), orderBy('timestamp', 'desc'), limit(50))),
        ]);

        const input: ComprehensiveAnalysisInput = {
            vitalsHistory: JSON.stringify(vitalsSnap.docs.map(d => d.data())),
            testStripHistory: JSON.stringify(stripsSnap.docs.map(d => d.data())),
            previousAnalyses: JSON.stringify(analysesSnap.docs.map(d => d.data().analysisResult)),
        };
        
        if (vitalsSnap.empty && stripsSnap.empty && analysesSnap.empty) {
            toast({ variant: 'destructive', title: 'Not Enough Data', description: 'There is no historical data to analyze yet.' });
            setIsAnalyzing(false);
            return;
        }

        const result = await performComprehensiveAnalysis(input);
        setAnalysisResult(result);
        setShowResultDialog(true);
    } catch (error) {
        console.error("Comprehensive analysis failed:", error);
        toast({
            variant: 'destructive', title: 'Analysis Failed',
            description: 'Could not perform the analysis. Please try again later.',
        });
    } finally {
        setIsAnalyzing(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl md:text-4xl font-bold text-foreground/90">
          Welcome back, {firstName}.
        </h1>
        <p className="text-lg text-muted-foreground">Let's check on your health today.</p>
      </div>

      <Card className="bg-primary/10 border-primary/20">
        <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
                <CardTitle className="flex items-center gap-2"><Search /> Health Investigation</CardTitle>
                <CardDescription className="mt-1">Feeling unwell? Start a step-by-step investigation with our AI to identify the issue.</CardDescription>
            </div>
            <Button size="lg" className="w-full md:w-auto" asChild>
                <Link href="/investigation">Start Investigation <ArrowRight className="ml-2"/></Link>
            </Button>
        </CardHeader>
      </Card>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>Your Quick Actions</CardTitle>
              <CardDescription>Key tools for your health journey.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {mainFeatures.map((feature) => (
                    <DashboardCard key={feature.href} {...feature} />
                ))}
            </CardContent>
          </Card>
        </div>
      </div>
      
       <Card className="bg-card/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Zap /> Deep Dive Analysis</CardTitle>
            <CardDescription>Let our AI perform a comprehensive review of your entire health history to find hidden trends and insights.</CardDescription>
          </CardHeader>
          <CardFooter>
            <Button variant="outline" onClick={handleDeepAnalysis} disabled={isAnalyzing}>
               {isAnalyzing ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analyzing History...</>
                ) : (
                  <>Run Deep Analysis</>
                )}
            </Button>
          </CardFooter>
      </Card>


      <Dialog open={showResultDialog} onOpenChange={setShowResultDialog}>
        <DialogContent className="max-w-2xl">
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                    <BrainCircuit className="text-primary"/>
                    Comprehensive Health Analysis
                </DialogTitle>
                <DialogDescription>
                    An AI-powered deep dive into your health trends.
                </DialogDescription>
            </DialogHeader>
            {analysisResult ? (
                <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-4 mt-4">
                    <div className="flex justify-between items-center">
                        <h3 className="text-lg font-bold">Overall Assessment</h3>
                        <Badge className={cn("text-white", UrgencyConfig[analysisResult.urgency]?.color)}>
                            {UrgencyConfig[analysisResult.urgency]?.text}
                        </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{analysisResult.overallAssessment}</p>

                    <div>
                        <h3 className="text-lg font-bold mb-2">Key Observations</h3>
                        <ul className="list-disc list-inside space-y-1 text-sm">
                            {analysisResult.keyObservations.map((obs, i) => <li key={i}>{obs}</li>)}
                        </ul>
                    </div>
                    
                    <div>
                        <h3 className="text-lg font-bold mb-2">Deep Insights</h3>
                        <div className="space-y-3">
                            {analysisResult.deepInsights.map((insight, i) => (
                                <Alert key={i} className="bg-secondary/50">
                                    <Lightbulb className="h-4 w-4" />
                                    <AlertTitle>{insight.insight}</AlertTitle>
                                    <AlertDescription>
                                        <span className="font-bold">Supporting Data:</span> {insight.supportingData}
                                    </AlertDescription>
                                </Alert>
                            ))}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="flex items-center justify-center p-8 h-64">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
