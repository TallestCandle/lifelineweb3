
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/context/auth-provider';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { format, parseISO, getMonth, getYear, setMonth, setYear, startOfMonth, endOfMonth } from 'date-fns';
import { Line, LineChart, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ChartConfig } from "@/components/ui/chart";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Loader } from '@/components/ui/loader';
import { Download, HeartPulse, Thermometer, Scale, Droplets, Activity, Siren } from 'lucide-react';
import { useProfile } from '@/context/profile-provider';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';


interface VitalsEntry {
  id: string; date: string; systolic?: string; diastolic?: string; oxygenLevel?: string;
  temperature?: string; bloodSugar?: string; weight?: string;
}
interface TriggeredAlert { id: string; message: string; timestamp: string; }

const bpChartConfig = {
  systolic: { label: "Systolic", color: "hsl(var(--chart-1))" },
  diastolic: { label: "Diastolic", color: "hsl(var(--chart-2))" },
} satisfies ChartConfig;

const sugarChartConfig = {
    value: { label: "Blood Sugar", color: "hsl(var(--chart-5))" },
} satisfies ChartConfig;

const months = Array.from({ length: 12 }, (_, i) => ({ value: i, label: format(new Date(0, i), 'MMMM') }));
const years = Array.from({ length: 5 }, (_, i) => getYear(new Date()) - i);

export function HealthReport() {
    const { user } = useAuth();
    const { activeProfile } = useProfile();
    const [isClient, setIsClient] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [monthlyData, setMonthlyData] = useState<{vitals: VitalsEntry[], alerts: TriggeredAlert[]}>({vitals: [], alerts: []});
    const [selectedDate, setSelectedDate] = useState(new Date());

    useEffect(() => {
        setIsClient(true);
    }, []);

    useEffect(() => {
        if (!isClient || !user || !activeProfile) {
            setMonthlyData({vitals: [], alerts: []});
            return;
        }
        
        const fetchMonthlyData = async () => {
            const startDate = startOfMonth(selectedDate).toISOString();
            const endDate = endOfMonth(selectedDate).toISOString();
            const basePath = `users/${user.uid}/profiles/${activeProfile.id}`;

            // Fetch Vitals for the month
            const vitalsCol = collection(db, `${basePath}/vitals`);
            const vitalsQuery = query(vitalsCol, where('date', '>=', startDate), where('date', '<=', endDate), orderBy('date', 'asc'));
            const vitalsSnapshot = await getDocs(vitalsQuery);
            const filteredVitals = vitalsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as VitalsEntry));

            // Fetch Alerts for the month
            const alertsCol = collection(db, `${basePath}/alerts`);
            const alertsQuery = query(alertsCol, where('timestamp', '>=', startDate), where('timestamp', '<=', endDate), orderBy('timestamp', 'desc'));
            const alertsSnapshot = await getDocs(alertsQuery);
            const filteredAlerts = alertsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TriggeredAlert));

            setMonthlyData({ vitals: filteredVitals, alerts: filteredAlerts });
        };
        
        fetchMonthlyData().catch(error => console.error("Error fetching report data:", error));

    }, [isClient, user, activeProfile, selectedDate]);
    
    const { filteredVitals, filteredAlerts } = monthlyData;

    const chartData = useMemo(() => {
        return filteredVitals
            .map(entry => ({
                date: format(parseISO(entry.date), 'MMM d'),
                systolic: entry.systolic ? Number(entry.systolic) : null,
                diastolic: entry.diastolic ? Number(entry.diastolic) : null,
                bloodSugar: entry.bloodSugar ? Number(entry.bloodSugar) : null,
            }));
    }, [filteredVitals]);


    const handleDownloadPdf = async () => {
        const reportElement = document.getElementById('report-content');
        if (!reportElement) return;

        setIsGenerating(true);
        try {
            const canvas = await html2canvas(reportElement, { scale: 2, useCORS: true });
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
                position = heightLeft - imgHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
                heightLeft -= pdfHeight;
            }
            
            const fileName = `Health_Report_${activeProfile?.name}_${format(selectedDate, 'MMMM_yyyy')}.pdf`;
            pdf.save(fileName);

        } catch (error) {
            console.error("Failed to generate PDF", error);
        } finally {
            setIsGenerating(false);
        }
    };
    
    if (!isClient || !activeProfile) return <Loader />;

    return (
        <div className="space-y-6">
             {isGenerating && (
                <div className="fixed inset-0 bg-black/50 z-50 flex flex-col items-center justify-center">
                    <Loader />
                    <p className="text-white mt-4 text-lg">Generating your report...</p>
                </div>
            )}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Monthly Health Report</CardTitle>
                        <CardDescription>Review and download a summary of your health data.</CardDescription>
                    </div>
                    <div className="flex gap-2">
                        <Select
                            value={String(getMonth(selectedDate))}
                            onValueChange={(value) => setSelectedDate(current => setMonth(current, Number(value)))}
                        >
                            <SelectTrigger className="w-[140px]">
                                <SelectValue placeholder="Select Month" />
                            </SelectTrigger>
                            <SelectContent>
                                {months.map(m => <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>)}
                            </SelectContent>
                        </Select>
                         <Select
                            value={String(getYear(selectedDate))}
                            onValueChange={(value) => setSelectedDate(current => setYear(current, Number(value)))}
                        >
                            <SelectTrigger className="w-[100px]">
                                <SelectValue placeholder="Select Year" />
                            </SelectTrigger>
                            <SelectContent>
                                {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Button onClick={handleDownloadPdf} disabled={isGenerating}>
                            <Download className="mr-2" /> Download PDF
                        </Button>
                    </div>
                </CardHeader>
            </Card>

            <Card id="report-content" className="p-8">
                <header className="border-b pb-4 mb-8">
                    <h1 className="text-3xl font-bold text-primary">Health Report</h1>
                    <p className="text-lg text-muted-foreground">{format(selectedDate, 'MMMM yyyy')}</p>
                    <div className="mt-4">
                        <p><span className="font-semibold">Patient:</span> {activeProfile?.name || 'N/A'}</p>
                        <p><span className="font-semibold">Age:</span> {activeProfile?.age || 'N/A'}</p>
                        <p><span className="font-semibold">Gender:</span> {activeProfile?.gender || 'N/A'}</p>
                    </div>
                </header>

                <section className="mb-8">
                    <h2 className="text-2xl font-semibold mb-4">Vitals Trends</h2>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div>
                            <h3 className="text-lg font-medium text-center mb-2">Blood Pressure (mmHg)</h3>
                            {chartData.filter(d => d.systolic || d.diastolic).length > 1 ? (
                                <ChartContainer config={bpChartConfig} className="min-h-[200px] w-full">
                                    <LineChart data={chartData} margin={{ left: 12, right: 12 }}>
                                        <CartesianGrid vertical={false} />
                                        <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
                                        <YAxis domain={['dataMin - 10', 'dataMax + 10']} />
                                        <Tooltip content={<ChartTooltipContent />} />
                                        <Line dataKey="systolic" type="monotone" stroke="var(--color-systolic)" strokeWidth={2} dot={true} />
                                        <Line dataKey="diastolic" type="monotone" stroke="var(--color-diastolic)" strokeWidth={2} dot={true} />
                                    </LineChart>
                                </ChartContainer>
                            ) : <p className="text-center text-muted-foreground p-8">Not enough data for chart.</p>}
                        </div>
                        <div>
                             <h3 className="text-lg font-medium text-center mb-2">Blood Sugar (mg/dL)</h3>
                             {chartData.filter(d => d.bloodSugar).length > 1 ? (
                                <ChartContainer config={sugarChartConfig} className="min-h-[200px] w-full">
                                    <LineChart data={chartData} margin={{ left: 12, right: 12 }}>
                                        <CartesianGrid vertical={false} />
                                        <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
                                        <YAxis domain={['dataMin - 10', 'dataMax + 10']} />
                                        <Tooltip content={<ChartTooltipContent />} />
                                        <Line dataKey="bloodSugar" type="monotone" name="value" stroke="var(--color-value)" strokeWidth={2} dot={true} />
                                    </LineChart>
                                </ChartContainer>
                             ) : <p className="text-center text-muted-foreground p-8">Not enough data for chart.</p>}
                        </div>
                    </div>
                </section>
                
                <section className="mb-8">
                    <h2 className="text-2xl font-semibold mb-4">Vitals Log</h2>
                    <div className="border rounded-lg">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date & Time</TableHead>
                                    <TableHead>Vitals</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredVitals.length > 0 ? filteredVitals.map(entry => (
                                    <TableRow key={entry.id}>
                                        <TableCell>{format(parseISO(entry.date), 'MMM d, yyyy, h:mm a')}</TableCell>
                                        <TableCell>
                                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                                                {entry.systolic && entry.diastolic && <span className="flex items-center gap-1"><HeartPulse className="w-4 h-4 text-destructive"/> {entry.systolic}/{entry.diastolic} mmHg</span>}
                                                {entry.oxygenLevel && <span className="flex items-center gap-1"><Activity className="w-4 h-4 text-primary"/> {entry.oxygenLevel}%</span>}
                                                {entry.temperature && <span className="flex items-center gap-1"><Thermometer className="w-4 h-4 text-accent-foreground"/> {entry.temperature}°F</span>}
                                                {entry.bloodSugar && <span className="flex items-center gap-1"><Droplets className="w-4 h-4 text-yellow-500"/> {entry.bloodSugar} mg/dL</span>}
                                                {entry.weight && <span className="flex items-center gap-1"><Scale className="w-4 h-4 text-green-500"/> {entry.weight} lbs</span>}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )) : <TableRow><TableCell colSpan={2} className="text-center h-24">No vitals logged this month.</TableCell></TableRow>}
                            </TableBody>
                        </Table>
                    </div>
                </section>

                <section>
                    <h2 className="text-2xl font-semibold mb-4">Triggered Alerts</h2>
                     {filteredAlerts.length > 0 ? (
                        <div className="space-y-4">
                            {filteredAlerts.map(alert => (
                                <Alert key={alert.id} variant="destructive">
                                    <Siren className="h-4 w-4" />
                                    <AlertTitle>{alert.message}</AlertTitle>
                                    <AlertDescription>
                                        Triggered on {format(parseISO(alert.timestamp), 'MMM d, yyyy, h:mm a')}
                                    </AlertDescription>
                                </Alert>
                            ))}
                        </div>
                    ) : (
                        <p className="text-muted-foreground">No health alerts were triggered this month.</p>
                    )}
                </section>
            </Card>
        </div>
    );
}
