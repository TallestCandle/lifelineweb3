"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lightbulb, Bookmark, BookmarkCheck } from 'lucide-react';
import { subDays, parseISO, getDayOfYear } from 'date-fns';
import { cn } from '@/lib/utils';

interface VitalsEntry {
  id: string; date: string; systolic?: string; diastolic?: string; oxygenLevel?: string;
  temperature?: string; bloodSugar?: string; weight?: string;
}

interface HealthTip {
  id: string;
  category: 'high_bp' | 'low_oxygen' | 'high_sugar' | 'general';
  text: string;
}

const allTips: HealthTip[] = [
  // High BP
  { id: 'bp1', category: 'high_bp', text: 'Reduce your salt intake to help manage blood pressure. Try seasoning food with herbs and spices instead.' },
  { id: 'bp2', category: 'high_bp', text: 'Monitor your blood pressure twice daily, once in the morning and once at night, to track its pattern.' },
  { id: 'bp3', category: 'high_bp', text: 'Regular physical activity, like a brisk 30-minute walk, can significantly help lower high blood pressure.' },
  // Low Oxygen
  { id: 'o2_1', category: 'low_oxygen', text: 'If you feel short of breath, try sitting upright, relax your shoulders, and practice deep, slow breathing.' },
  { id: 'o2_2', category: 'low_oxygen', text: 'Ensure good ventilation in your room. Opening a window for fresh air can be beneficial.' },
  // High Sugar
  { id: 'sug1', category: 'high_sugar', text: 'Opt for whole grains and fiber-rich vegetables to help stabilize your blood sugar levels.' },
  { id: 'sug2', category: 'high_sugar', text: 'Staying hydrated is key. Drinking plenty of water helps your kidneys flush out excess sugar.' },
  // General
  { id: 'gen1', category: 'general', text: 'Aim for 7-8 hours of quality sleep per night to support your overall health and recovery.' },
  { id: 'gen2', category: 'general', text: 'Incorporate a variety of colorful fruits and vegetables into your diet for a wide range of nutrients.' },
  { id: 'gen3', category: 'general', text: 'A short 10-minute walk after meals can aid digestion and improve your mood.' },
];

const VITALS_LOCAL_STORAGE_KEY = 'nexus-lifeline-vitals';
const BOOKMARKS_LOCAL_STORAGE_KEY = 'nexus-lifeline-bookmarked-tips';

export function HealthTips() {
    const [isClient, setIsClient] = useState(false);
    const [dailyTip, setDailyTip] = useState<HealthTip | null>(null);
    const [bookmarkedTips, setBookmarkedTips] = useState<string[]>([]); // array of tip ids

    useEffect(() => {
        setIsClient(true);
        try {
            const storedBookmarks = window.localStorage.getItem(BOOKMARKS_LOCAL_STORAGE_KEY);
            if (storedBookmarks) {
                setBookmarkedTips(JSON.parse(storedBookmarks));
            }

            const storedVitalsRaw = window.localStorage.getItem(VITALS_LOCAL_STORAGE_KEY);
            const allVitals: VitalsEntry[] = storedVitalsRaw ? JSON.parse(storedVitalsRaw) : [];
            
            // Determine relevant tips
            const sevenDaysAgo = subDays(new Date(), 7);
            const weeklyVitals = allVitals.filter(v => parseISO(v.date) >= sevenDaysAgo);

            let relevantCategories: HealthTip['category'][] = [];
            
            const hasHighBP = weeklyVitals.some(v => parseInt(v.systolic || '0') > 140 || parseInt(v.diastolic || '0') > 90);
            const hasLowO2 = weeklyVitals.some(v => parseInt(v.oxygenLevel || '100') < 95);
            const hasHighSugar = weeklyVitals.some(v => parseInt(v.bloodSugar || '0') > 180);

            if (hasHighBP) relevantCategories.push('high_bp');
            if (hasLowO2) relevantCategories.push('low_oxygen');
            if (hasHighSugar) relevantCategories.push('high_sugar');

            let applicableTips: HealthTip[];
            if (relevantCategories.length > 0) {
                applicableTips = allTips.filter(tip => relevantCategories.includes(tip.category));
            } else {
                applicableTips = allTips.filter(tip => tip.category === 'general');
            }

            // Rotate daily
            const dayIndex = getDayOfYear(new Date()) % applicableTips.length;
            setDailyTip(applicableTips[dayIndex]);

        } catch (error) {
            console.error("Error processing health tips:", error);
            const generalTips = allTips.filter(tip => tip.category === 'general');
            const dayIndex = getDayOfYear(new Date()) % generalTips.length;
            setDailyTip(generalTips[dayIndex]);
        }
    }, []);

    useEffect(() => {
        if (isClient) {
            window.localStorage.setItem(BOOKMARKS_LOCAL_STORAGE_KEY, JSON.stringify(bookmarkedTips));
        }
    }, [bookmarkedTips, isClient]);

    const toggleBookmark = (tipId: string) => {
        setBookmarkedTips(prev => 
            prev.includes(tipId)
                ? prev.filter(id => id !== tipId)
                : [...prev, tipId]
        );
    };

    const isBookmarked = (tipId: string) => bookmarkedTips.includes(tipId);

    const bookmarkedTipObjects = useMemo(() => {
        return allTips.filter(tip => bookmarkedTips.includes(tip.id));
    }, [bookmarkedTips]);

    if (!isClient) return null;

    return (
        <div className="space-y-6">
            <Card className="bg-accent/30 border-accent">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Lightbulb className="w-6 h-6 text-accent-foreground" />
                        <span>Today's Health Tip</span>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {dailyTip ? (
                        <div className="flex items-start gap-4">
                            <p className="text-base flex-grow">{dailyTip.text}</p>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => toggleBookmark(dailyTip.id)}
                                title={isBookmarked(dailyTip.id) ? "Remove Bookmark" : "Bookmark Tip"}
                            >
                                {isBookmarked(dailyTip.id) ? (
                                    <BookmarkCheck className="w-5 h-5 text-primary" />
                                ) : (
                                    <Bookmark className="w-5 h-5" />
                                )}
                            </Button>
                        </div>
                    ) : (
                        <p className="text-muted-foreground">Loading health tip...</p>
                    )}
                </CardContent>
            </Card>

            {bookmarkedTipObjects.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                             <Bookmark className="w-6 h-6" />
                            <span>Bookmarked Tips</span>
                        </CardTitle>
                        <CardDescription>Your saved tips for quick reference.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ul className="space-y-3">
                            {bookmarkedTipObjects.map(tip => (
                                <li key={tip.id} className="flex items-start gap-4 text-sm p-3 rounded-md bg-secondary/50">
                                   <Lightbulb className="w-5 h-5 mt-0.5 text-primary shrink-0" />
                                   <span className="flex-grow">{tip.text}</span>
                                </li>
                            ))}
                        </ul>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
