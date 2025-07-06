
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Apple, GlassWater, HeartPulse, Move, Beaker, Bed, Clock, ClipboardCheck } from "lucide-react";
import { useAuth } from '@/context/auth-provider';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, doc, setDoc, getDoc, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import Confetti from 'react-confetti';
import { format, subDays } from 'date-fns';
import { generateDailyTasks } from '@/ai/flows/generate-daily-tasks-flow';
import { Loader } from '../ui/loader';
import { cn } from '@/lib/utils';

interface Task {
  text: string;
  iconName: keyof typeof TaskIcons;
  completed: boolean;
}

const TaskIcons = {
    HeartPulse,
    GlassWater,
    Move,
    Apple,
    Beaker,
    Bed,
};

const useWindowDimensions = () => {
    const [windowDimensions, setWindowDimensions] = useState({ width: 0, height: 0 });
    useEffect(() => {
        function handleResize() {
            setWindowDimensions({ width: window.innerWidth, height: window.innerHeight });
        }
        if (typeof window !== 'undefined') {
            handleResize();
            window.addEventListener('resize', handleResize);
            return () => window.removeEventListener('resize', handleResize);
        }
    }, []);
    return windowDimensions;
};

const calculateTimeLeft = () => {
    const now = new Date();
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);
    const difference = endOfDay.getTime() - now.getTime();
    if (difference <= 0) return { hours: 0, minutes: 0, seconds: 0 };
    return {
        hours: Math.floor(difference / (1000 * 60 * 60)),
        minutes: Math.floor((difference / 1000 / 60) % 60),
        seconds: Math.floor((difference / 1000) % 60),
    };
};

export function TaskList() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [tasks, setTasks] = useState<Task[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isClient, setIsClient] = useState(false);
    const [showConfetti, setShowConfetti] = useState(false);
    const { width, height } = useWindowDimensions();
    const [timeLeft, setTimeLeft] = useState(calculateTimeLeft());

    useEffect(() => {
      setIsClient(true);
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => {
            setTimeLeft(calculateTimeLeft());
        }, 1000);
        return () => clearTimeout(timer);
    });

    useEffect(() => {
        if (!isClient || !user) {
            setIsLoading(false);
            setTasks([]);
            return;
        }

        const todayDateStr = format(new Date(), 'yyyy-MM-dd');
        const tasksDocRef = doc(db, `users/${user.uid}/daily_tasks`, todayDateStr);

        const fetchAndSetTasks = async () => {
            const docSnap = await getDoc(tasksDocRef);

            if (docSnap.exists()) {
                setTasks(docSnap.data().tasks);
                setIsLoading(false);
            } else {
                setIsLoading(true);
                try {
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

                    const result = await generateDailyTasks({ healthSummary });
                    const newTasks = result.tasks.map(task => ({ ...task, completed: false }));
                    await setDoc(tasksDocRef, { tasks: newTasks });
                    setTasks(newTasks);
                } catch (error) {
                    console.error("Failed to generate AI tasks:", error);
                    toast({ variant: 'destructive', title: "AI Error", description: "Could not generate daily tasks." });
                } finally {
                    setIsLoading(false);
                }
            }
        };

        fetchAndSetTasks();

    }, [isClient, user, toast]);

    const handleTaskToggle = useCallback(async (taskIndex: number) => {
        if (!user) return;

        const newTasks = [...tasks];
        const task = newTasks[taskIndex];
        if (!task) return;
        
        newTasks[taskIndex] = { ...task, completed: !task.completed };
        setTasks(newTasks);

        const todayDateStr = format(new Date(), 'yyyy-MM-dd');
        const taskDocRef = doc(db, `users/${user.uid}/daily_tasks`, todayDateStr);

        try {
            await setDoc(taskDocRef, { tasks: newTasks });
            if (newTasks.every(t => t.completed)) {
                setShowConfetti(true);
                setTimeout(() => setShowConfetti(false), 5000);
            }
        } catch (error) {
            console.error("Error updating task:", error);
            toast({ variant: 'destructive', title: "Update Failed", description: "Could not save task status." });
            setTasks(tasks); // Revert on failure
        }
    }, [user, tasks, toast]);

    const completedTasks = tasks.filter(task => task.completed).length;
    const totalTasks = tasks.length;
    const progressPercentage = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

    if (!isClient) return null;

    return (
        <>
            {showConfetti && <Confetti width={width} height={height} recycle={false} numberOfPieces={500} gravity={0.2} />}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-3"><ClipboardCheck className="w-8 h-8 text-primary"/> Your AI-Powered Daily Plan</CardTitle>
                    <CardDescription>
                        {completedTasks} of {totalTasks} tasks completed. Keep it up!
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex flex-col gap-4">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-secondary/50 p-2 rounded-lg">
                            <Clock className="w-4 h-4 text-primary"/>
                            <span>New tasks in:</span>
                            <span className="font-mono font-bold text-foreground">{String(timeLeft.hours).padStart(2, '0')}:{String(timeLeft.minutes).padStart(2, '0')}:{String(timeLeft.seconds).padStart(2, '0')}</span>
                        </div>
                        <div className="flex items-center gap-4">
                            <Progress value={progressPercentage} className="w-full" />
                            <span className="text-sm font-bold text-muted-foreground whitespace-nowrap">
                                {Math.round(progressPercentage)}%
                            </span>
                        </div>
                    </div>
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center h-48 gap-4">
                            <Loader />
                            <p className="text-muted-foreground">Your AI coach is creating a personalized plan...</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {tasks.map((task, index) => {
                                const Icon = TaskIcons[task.iconName] || Move;
                                return (
                                    <div
                                        key={index}
                                        data-completed={task.completed}
                                        className="flex items-center space-x-4 p-4 rounded-lg transition-colors border border-transparent data-[completed=true]:border-primary/50 data-[completed=true]:bg-primary/10"
                                    >
                                        <Checkbox
                                            id={`task-${index}`}
                                            checked={task.completed}
                                            onCheckedChange={() => handleTaskToggle(index)}
                                            aria-labelledby={`task-label-${index}`}
                                        />
                                        <div className="flex items-center gap-3 flex-grow">
                                            <Icon className={cn("w-6 h-6 transition-colors", task.completed ? "text-primary/50" : "text-primary")} />
                                            <Label
                                                htmlFor={`task-${index}`}
                                                id={`task-label-${index}`}
                                                className={cn("text-base cursor-pointer transition-colors", task.completed ? "line-through text-muted-foreground" : "text-foreground")}
                                            >
                                                {task.text}
                                            </Label>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>
        </>
    );
}
