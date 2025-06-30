
"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ListChecks,
  HeartPulse,
  Beaker,
  Pill,
  BrainCircuit,
  FileText,
  Siren,
  Salad,
  Zap,
  Loader2,
  Lightbulb,
  Video
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from '@/lib/utils';
import { useProfile } from '@/context/profile-provider';
import { useAuth } from '@/context/auth-provider';
import { db } from '@/lib/firebase';
import { collection, query, getDocs, orderBy, limit } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { performComprehensiveAnalysis, type ComprehensiveAnalysisInput, type ComprehensiveAnalysisOutput } from '@/ai/flows/comprehensive-analysis-flow';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

type DashboardColor = "chart-1" | "destructive" | "chart-2" | "chart-4" | "chart-5" | "primary" | "chart-3";

interface MenuItem {
  href: string;
  label: string;
  icon: LucideIcon;
  colorClass: `text-${DashboardColor}`;
  borderClass: `group-hover:border-${DashboardColor}`;
  shadowClass: `group-hover:shadow-${DashboardColor}/40`;
  glowClass: `bg-${DashboardColor}/10`;
}

const menuItems: MenuItem[] = [
    { href: "/tasks", label: "Daily Tasks", icon: ListChecks, colorClass: "text-chart-1", borderClass: "group-hover:border-chart-1", shadowClass: "group-hover:shadow-chart-1/40", glowClass: "bg-chart-1/10" },
    { href: "/vitals", label: "Vitals Log", icon: HeartPulse, colorClass: "text-destructive", borderClass: "group-hover:border-destructive", shadowClass: "group-hover:shadow-destructive/40", glowClass: "bg-destructive/10" },
    { href: "/test-strips", label: "Test Strips", icon: Beaker, colorClass: "text-chart-2", borderClass: "group-hover:border-chart-2", shadowClass: "group-hover:shadow-chart-2/40", glowClass: "bg-chart-2/10" },
    { href: "/reminders", label: "Medication", icon: Pill, colorClass: "text-chart-4", borderClass: "group-hover:border-chart-4", shadowClass: "group-hover:shadow-chart-4/40", glowClass: "bg-chart-4/10" },
    { href: "/analysis", label: "AI Analysis", icon: BrainCircuit, colorClass: "text-chart-5", borderClass: "group-hover:border-chart-5", shadowClass: "group-hover:shadow-chart-5/40", glowClass: "bg-chart-5/10" },
    { href: "/report", label: "Health Report", icon: FileText, colorClass: "text-primary", borderClass: "group-hover:border-primary", shadowClass: "group-hover:shadow-primary/40", glowClass: "bg-primary/10" },
    { href: "/dietician", label: "AI Dietician", icon: Salad, colorClass: "text-chart-3", borderClass: "group-hover:border-chart-3", shadowClass: "group-hover:shadow-chart-3/40", glowClass: "bg-chart-3/10" },
    { href: "/emergency", label: "Emergency", icon: Siren, colorClass: "text-destructive", borderClass: "group-hover:border-destructive", shadowClass: "group-hover:shadow-destructive/40", glowClass: "bg-destructive/10" },
];

const UrgencyConfig: Record<string, { color: string; text: string }> = {
    'Mild': { color: 'bg-yellow-400', text: 'Mild' },
    'Moderate': { color: 'bg-orange-500', text: 'Moderate' },
    'Critical': { color: 'bg-red-600', text: 'Critical' },
};

export function Dashboard() {
  const { activeProfile } = useProfile();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<ComprehensiveAnalysisOutput | null>(null);
  const [showResultDialog, setShowResultDialog] = useState(false);
  
  const firstName = activeProfile?.name.split(' ')[0];
  const greeting = firstName ? `Welcome, ${firstName}.` : 'Welcome.';

  const handleGeneralAnalysis = async () => {
    if (!user || !activeProfile) {
        toast({ variant: 'destructive', title: 'Error', description: 'No active profile found.' });
        return;
    }
    setIsAnalyzing(true);
    setAnalysisResult(null);

    try {
        const basePath = `users/${user.uid}/profiles/${activeProfile.id}`;
        
        const vitalsCol = collection(db, `${basePath}/vitals`);
        const stripsCol = collection(db, `${basePath}/test_strips`);
        const analysesCol = collection(db, `${basePath}/health_analyses`);

        const [vitalsSnap, stripsSnap, analysesSnap] = await Promise.all([
            getDocs(query(vitalsCol, orderBy('date', 'desc'), limit(50))),
            getDocs(query(stripsCol, orderBy('date', 'desc'), limit(50))),
            getDocs(query(analysesCol, orderBy('timestamp', 'desc'), limit(20))),
        ]);

        const vitalsHistory = vitalsSnap.docs.map(d => d.data());
        const testStripHistory = stripsSnap.docs.map(d => d.data());
        const previousAnalyses = analysesSnap.docs.map(d => d.data().analysisResult);

        if (vitalsHistory.length === 0 && testStripHistory.length === 0 && previousAnalyses.length === 0) {
            toast({ variant: 'destructive', title: 'Not Enough Data', description: 'There is no historical data to analyze yet.' });
            setIsAnalyzing(false);
            return;
        }

        const input: ComprehensiveAnalysisInput = {
            vitalsHistory: JSON.stringify(vitalsHistory),
            testStripHistory: JSON.stringify(testStripHistory),
            previousAnalyses: JSON.stringify(previousAnalyses),
        };

        const result = await performComprehensiveAnalysis(input);
        setAnalysisResult(result);
        setShowResultDialog(true);
    } catch (error) {
        console.error("Comprehensive analysis failed:", error);
        toast({
            variant: 'destructive',
            title: 'Analysis Failed',
            description: 'Could not perform the analysis. Please try again later.',
        });
    } finally {
        setIsAnalyzing(false);
    }
  };


  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-foreground/90">
          {greeting}
        </h1>
        <p className="text-muted-foreground">Here's your command center for a healthier life.</p>
      </div>
      <div className="grid grid-cols-4 gap-4 pt-4">
        {menuItems.map((item) => (
            <Link 
              key={item.href}
              href={item.href}
              className="flex flex-col items-center justify-start text-center gap-2 cursor-pointer group"
            >
              <div className={cn(
                "relative flex items-center justify-center bg-card/50 p-3 rounded-full shadow-lg border border-primary/20 transition-all duration-300 group-hover:-translate-y-1",
                item.borderClass,
                `group-hover:shadow-lg ${item.shadowClass}`
              )}>
                <div className={cn(
                  "absolute inset-0 rounded-full blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-300",
                  item.glowClass
                )} />
                <item.icon className={cn("w-6 h-6 transition-colors duration-300", item.colorClass)} />
              </div>
              <div className="h-8 flex items-center">
                  <p className="text-xs font-bold text-foreground/80 transition-colors duration-300 group-hover:text-foreground">{item.label}</p>
              </div>
            </Link>
          ))}
      </div>

      <div className="space-y-6 mt-6">
          <Card className="border-accent/50 shadow-accent/10 hover:border-accent/80 hover:shadow-accent/20">
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle className="text-accent text-xl">Health Insights</CardTitle>
                <CardDescription>Analyze your long-term health trends.</CardDescription>
              </div>
              <Button onClick={handleGeneralAnalysis} disabled={isAnalyzing} size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90">
                {isAnalyzing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Zap className="mr-2 h-5 w-5" />
                    Run Analysis
                  </>
                )}
              </Button>
            </CardHeader>
          </Card>

           <Link href="/doctors">
                <Card className="border-primary/50 shadow-primary/10 hover:border-primary/80 hover:shadow-primary/20 transition-all hover:scale-[1.01]">
                    <CardHeader className="flex-row items-center justify-between">
                        <div>
                            <CardTitle className="text-primary text-xl">Consult a Doctor</CardTitle>
                            <CardDescription>Book a video or audio call with a professional.</CardDescription>
                        </div>
                        <Button size="lg">
                            <Video className="mr-2 h-5 w-5" />
                            Book Now
                        </Button>
                    </CardHeader>
                </Card>
            </Link>
      </div>

      <Dialog open={showResultDialog} onOpenChange={setShowResultDialog}>
        <DialogContent className="max-w-2xl">
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                    <BrainCircuit className="text-primary"/>
                    Health Insights
                </DialogTitle>
                <DialogDescription>
                    An AI-powered deep dive into your health trends for {activeProfile?.name}.
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
