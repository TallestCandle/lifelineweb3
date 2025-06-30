
"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/auth-provider';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { format, parseISO, getMonth, getYear, setMonth, setYear, startOfMonth, endOfMonth } from 'date-fns';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader } from '@/components/ui/loader';
import { Download, FileText, HeartPulse, Beaker, TrendingUp, ShieldAlert, ListChecks } from 'lucide-react';
import { useProfile } from '@/context/profile-provider';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { generateMonthlyReport, type GenerateMonthlyReportOutput } from '@/ai/flows/generate-monthly-report-flow';
import { Badge } from '../ui/badge';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';


const months = Array.from({ length: 12 }, (_, i) => ({ value: i, label: format(new Date(0, i), 'MMMM') }));
const years = Array.from({ length: 5 }, (_, i) => getYear(new Date()) - i);

const RiskConfig: Record<string, { color: string; text: string, borderColor: string }> = {
    'Low': { color: 'bg-green-500', text: 'Low', borderColor: 'border-green-500/50' },
    'Medium': { color: 'bg-yellow-500', text: 'Medium', borderColor: 'border-yellow-500/50' },
    'High': { color: 'bg-orange-500', text: 'High', borderColor: 'border-orange-500/50' },
    'Critical': { color: 'bg-red-600', text: 'Critical', borderColor: 'border-red-600/50' },
};


export function HealthReport() {
    const { user } = useAuth();
    const { activeProfile } = useProfile();
    const { toast } = useToast();
    
    const [isClient, setIsClient] = useState(false);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const [isGeneratingReport, setIsGeneratingReport] = useState(true);
    
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [reportContent, setReportContent] = useState<GenerateMonthlyReportOutput | null>(null);

    useEffect(() => {
        setIsClient(true);
    }, []);

    useEffect(() => {
        if (!isClient || !user || !activeProfile) {
            setReportContent(null);
            setIsGeneratingReport(false);
            return;
        }
        
        const fetchAndGenerateReport = async () => {
            setIsGeneratingReport(true);
            setReportContent(null);
            
            const startDate = startOfMonth(selectedDate).toISOString();
            const endDate = endOfMonth(selectedDate).toISOString();
            const basePath = `users/${user.uid}/profiles/${activeProfile.id}`;

            try {
                // Fetch all required data for the month
                const vitalsCol = collection(db, `${basePath}/vitals`);
                const vitalsQuery = query(vitalsCol, where('date', '>=', startDate), where('date', '<=', endDate));
                
                const stripsCol = collection(db, `${basePath}/test_strips`);
                const stripsQuery = query(stripsCol, where('date', '>=', startDate), where('date', '<=', endDate));

                const analysesCol = collection(db, `${basePath}/health_analyses`);
                const analysesQuery = query(analysesCol, where('timestamp', '>=', startDate), where('timestamp', '<=', endDate));
                
                const alertsCol = collection(db, `${basePath}/alerts`);
                const alertsQuery = query(alertsCol, where('timestamp', '>=', startDate), where('timestamp', '<=', endDate));
                
                const [vitalsSnap, stripsSnap, analysesSnap, alertsSnap] = await Promise.all([
                    getDocs(vitalsQuery),
                    getDocs(stripsQuery),
                    getDocs(analysesQuery),
                    getDocs(alertsQuery),
                ]);

                const vitalsHistory = vitalsSnap.docs.map(d => d.data());
                const testStripHistory = stripsSnap.docs.map(d => d.data());
                const analysesHistory = analysesSnap.docs.map(d => d.data().analysisResult);
                const alertsHistory = alertsSnap.docs.map(d => d.data());

                if (vitalsHistory.length === 0 && testStripHistory.length === 0 && analysesHistory.length === 0 && alertsHistory.length === 0) {
                     toast({
                        variant: "destructive",
                        title: "No Data Available",
                        description: `There is no health data recorded for ${format(selectedDate, 'MMMM yyyy')}.`,
                    });
                    setReportContent(null);
                    return;
                }

                // Call the AI flow
                const report = await generateMonthlyReport({
                    profile: { name: activeProfile.name, age: activeProfile.age, gender: activeProfile.gender },
                    month: format(selectedDate, 'MMMM yyyy'),
                    vitalsHistory: JSON.stringify(vitalsHistory),
                    testStripHistory: JSON.stringify(testStripHistory),
                    analysesHistory: JSON.stringify(analysesHistory),
                    alertsHistory: JSON.stringify(alertsHistory),
                });
                
                setReportContent(report);

            } catch (error) {
                console.error("Error generating AI report:", error);
                toast({
                    variant: 'destructive',
                    title: 'Report Generation Failed',
                    description: 'The AI could not generate a report. Please try again later.',
                });
            } finally {
                setIsGeneratingReport(false);
            }
        };
        
        fetchAndGenerateReport();

    }, [isClient, user, activeProfile, selectedDate, toast]);
    

    const handleDownloadPdf = async () => {
        const reportElement = document.getElementById('report-content');
        const body = document.body;
        if (!reportElement || !reportContent) return;

        setIsGeneratingPdf(true);
        try {
            const backgroundColor = window.getComputedStyle(body).backgroundColor;
            const canvas = await html2canvas(reportElement, { scale: 2, useCORS: true, backgroundColor });
            const imgData = canvas.toDataURL('image/png');
            
            const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const canvasWidth = canvas.width;
            const canvasHeight = canvas.height;
            const ratio = canvasWidth / pdfWidth;
            const imgHeight = canvasHeight / ratio;

            let heightLeft = imgHeight;
            let position = 0;

            pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
            heightLeft -= pdfHeight;

            while (heightLeft > 0) {
                position -= pdfHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
                heightLeft -= pdfHeight;
            }
            
            const fileName = `Health_Report_${activeProfile?.name}_${format(selectedDate, 'MMMM_yyyy')}.pdf`;
            pdf.save(fileName);

        } catch (error) {
            console.error("Failed to generate PDF", error);
        } finally {
            setIsGeneratingPdf(false);
        }
    };
    
    if (!isClient) return <Loader />;

    return (
        <div className="space-y-6">
             {(isGeneratingPdf || (isGeneratingReport && !reportContent)) && (
                <div className="fixed inset-0 bg-black/50 z-50 flex flex-col items-center justify-center">
                    <Loader />
                    <p className="text-white mt-4 text-lg">
                        {isGeneratingPdf ? 'Generating your PDF...' : 'AI is analyzing your monthly data...'}
                    </p>
                </div>
            )}
            <Card>
                <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <CardTitle>AI-Powered Monthly Report</CardTitle>
                        <CardDescription>A comprehensive AI analysis of your health data for the selected month.</CardDescription>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <Select
                            value={String(getMonth(selectedDate))}
                            onValueChange={(value) => setSelectedDate(current => setMonth(current, Number(value)))}
                        >
                            <SelectTrigger className="w-full sm:w-[140px]"><SelectValue placeholder="Select Month" /></SelectTrigger>
                            <SelectContent>
                                {months.map(m => <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>)}
                            </SelectContent>
                        </Select>
                         <Select
                            value={String(getYear(selectedDate))}
                            onValueChange={(value) => setSelectedDate(current => setYear(current, Number(value)))}
                        >
                            <SelectTrigger className="w-full sm:w-[100px]"><SelectValue placeholder="Select Year" /></SelectTrigger>
                            <SelectContent>
                                {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Button onClick={handleDownloadPdf} disabled={isGeneratingPdf || isGeneratingReport || !reportContent} className="w-full sm:w-auto">
                            <Download className="mr-2" /> Download PDF
                        </Button>
                    </div>
                </CardHeader>
            </Card>

            <Card id="report-content" className="p-4 md:p-8 bg-background text-foreground">
                 {isGeneratingReport ? (
                    <div className="flex flex-col items-center justify-center h-96 gap-4">
                        <Loader />
                        <p className="text-muted-foreground">The AI is performing a deep analysis of your monthly data...</p>
                    </div>
                 ) : reportContent ? (
                    <div className="space-y-8">
                        <header className="border-b pb-4 mb-8 text-center">
                            <h1 className="text-3xl font-bold text-primary">{reportContent.title}</h1>
                            <div className="mt-4 flex justify-center gap-8 text-sm text-muted-foreground">
                                <span><strong className="text-foreground">Patient:</strong> {activeProfile?.name || 'N/A'}</span>
                                <span><strong className="text-foreground">Age:</strong> {activeProfile?.age || 'N/A'}</span>
                                <span><strong className="text-foreground">Gender:</strong> {activeProfile?.gender || 'N/A'}</span>
                            </div>
                        </header>
                        
                        <section>
                            <h2 className="text-2xl font-bold mb-4 flex items-center gap-3"><FileText className="text-primary"/> Executive Summary</h2>
                            <p className="text-base text-muted-foreground whitespace-pre-line">{reportContent.overallSummary}</p>
                        </section>
                        
                        <section>
                            <Alert className={cn("border-2", RiskConfig[reportContent.riskAssessment.level]?.borderColor)}>
                                <ShieldAlert className="h-5 w-5" />
                                <AlertTitle className="flex justify-between items-center">
                                    <span>{reportContent.riskAssessment.title}</span>
                                    <Badge className={cn("text-white", RiskConfig[reportContent.riskAssessment.level]?.color)}>
                                        {RiskConfig[reportContent.riskAssessment.level]?.text}
                                    </Badge>
                                </AlertTitle>
                                <AlertDescription className="mt-2">{reportContent.riskAssessment.explanation}</AlertDescription>
                            </Alert>
                        </section>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <section>
                                <h2 className="text-2xl font-bold mb-4 flex items-center gap-3"><HeartPulse className="text-primary"/> {reportContent.vitalsAnalysis.title}</h2>
                                <p className="text-sm text-muted-foreground whitespace-pre-line">{reportContent.vitalsAnalysis.content}</p>
                            </section>
                            <section>
                                <h2 className="text-2xl font-bold mb-4 flex items-center gap-3"><Beaker className="text-primary"/> {reportContent.testStripAnalysis.title}</h2>
                                <p className="text-sm text-muted-foreground whitespace-pre-line">{reportContent.testStripAnalysis.content}</p>
                            </section>
                        </div>
                        
                        <section>
                            <h2 className="text-2xl font-bold mb-4 flex items-center gap-3"><TrendingUp className="text-primary"/> {reportContent.trendsAndCorrelations.title}</h2>
                            <ul className="space-y-2 list-disc list-inside text-sm text-muted-foreground">
                                {reportContent.trendsAndCorrelations.insights.map((insight, index) => <li key={index}>{insight}</li>)}
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-2xl font-bold mb-4 flex items-center gap-3"><ListChecks className="text-primary"/> {reportContent.recommendations.title}</h2>
                             <ul className="space-y-2 list-disc list-inside text-sm text-muted-foreground">
                                {reportContent.recommendations.points.map((rec, index) => <li key={index}>{rec}</li>)}
                            </ul>
                        </section>

                    </div>
                 ) : (
                    <div className="text-center py-10">
                        <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
                        <h3 className="mt-2 text-sm font-bold text-foreground">No Report Generated</h3>
                        <p className="mt-1 text-sm text-muted-foreground">There was no data to generate a report for the selected month, or an error occurred.</p>
                    </div>
                 )}
            </Card>
        </div>
    );
}
