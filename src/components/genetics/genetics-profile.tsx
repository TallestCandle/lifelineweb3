
"use client";

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Dna, Sparkles, TestTube, Pill, Heart, Activity, BadgePercent, Clock } from 'lucide-react';
import { Button } from '../ui/button';
import { motion } from 'framer-motion';

const FeatureListItem = ({ icon, title, description }: { icon: React.ElementType, title: string, description: string }) => {
    const Icon = icon;
    return (
        <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <Icon className="w-6 h-6" />
            </div>
            <div>
                <h4 className="font-bold">{title}</h4>
                <p className="text-sm text-muted-foreground">{description}</p>
            </div>
        </div>
    );
};

export function GeneticsProfile() {
    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
            >
                <Card className="text-center bg-gradient-to-b from-primary/10 to-transparent border-primary/20 shadow-lg shadow-primary/5">
                    <CardHeader>
                        <div className="flex justify-center items-center gap-4 mb-4">
                            <Dna className="w-12 h-12 text-primary" />
                            <Sparkles className="w-8 h-8 text-accent" />
                        </div>
                        <CardTitle className="text-4xl font-extrabold tracking-tight">Genetics Profile: Unlock Your Blueprint</CardTitle>
                        <CardDescription className="text-xl font-semibold text-primary">
                            Coming Soon!
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="max-w-2xl mx-auto text-muted-foreground">
                            We are putting the finishing touches on a groundbreaking feature that will allow you to securely upload your raw DNA data (from services like 23andMe or AncestryDNA) and receive personalized, AI-driven insights like never before.
                        </p>
                    </CardContent>
                </Card>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
            >
                <Card>
                    <CardHeader>
                        <CardTitle>What You'll Be Able to Do</CardTitle>
                        <CardDescription>Get ready to explore the unique story your DNA tells.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <FeatureListItem
                            icon={BadgePercent}
                            title="Discover Your Ancestry Traits"
                            description="Uncover predispositions for physical characteristics like eye color, hair type, and more, based on your genetic markers."
                        />
                        <FeatureListItem
                            icon={Heart}
                            title="Explore Health & Wellness Markers"
                            description="Learn about genetic associations with general wellness factors, such as metabolism, appetite, and your body's response to different types of exercise."
                        />
                        <FeatureListItem
                            icon={Activity}
                            title="Understand Vitamin Metabolism"
                            description="Gain insights into how your body may process essential vitamins like Vitamin B12 and D, helping you tailor your nutritional focus."
                        />
                        <FeatureListItem
                            icon={Pill}
                            title="Analyze Common Drug Responses"
                            description="See how your genes might influence your body's response to common substances, including caffeine and certain widely-used medications."
                        />
                    </CardContent>
                </Card>
            </motion.div>
            
             <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.4 }}
            >
                <div className="text-center p-6 bg-secondary rounded-lg">
                    <h3 className="text-2xl font-bold mb-2">Stay Tuned!</h3>
                    <p className="text-muted-foreground">This powerful feature is under active development and will be launching soon. We can't wait for you to experience it.</p>
                </div>
            </motion.div>
        </div>
    );
}
