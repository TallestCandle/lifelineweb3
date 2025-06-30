'use server';
/**
 * @fileOverview An AI agent for generating personalized daily health tasks.
 *
 * - generateDailyTasks - A function that creates daily tasks based on health data.
 * - GenerateDailyTasksInput - The input type for the function.
 * - GenerateDailyTasksOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const GenerateDailyTasksInputSchema = z.object({
  healthSummary: z.string().describe("A JSON string representing recent health data including vitals, test strips, and previous AI analyses."),
}).describe("A summary of the user's recent health data.");

export type GenerateDailyTasksInput = z.infer<typeof GenerateDailyTasksInputSchema>;

const TaskSchema = z.object({
    text: z.string().describe("A short, actionable description of the health task."),
    iconName: z.enum(['HeartPulse', 'GlassWater', 'Move', 'Apple', 'Beaker', 'Bed']).describe("The most relevant icon for the task."),
});

const GenerateDailyTasksOutputSchema = z.object({
    tasks: z.array(TaskSchema).min(4).max(5).describe("A list of 4-5 personalized daily health tasks."),
});

export type GenerateDailyTasksOutput = z.infer<typeof GenerateDailyTasksOutputSchema>;

export async function generateDailyTasks(input: GenerateDailyTasksInput): Promise<GenerateDailyTasksOutput> {
  return generateDailyTasksFlow(input);
}

const prompt = ai.definePrompt({
    name: 'generateDailyTasksPrompt',
    input: { schema: GenerateDailyTasksInputSchema },
    output: { schema: GenerateDailyTasksOutputSchema },
    prompt: `You are a motivating and insightful AI health coach. Your goal is to create a short, personalized list of 4-5 actionable health tasks for the user's day.

Analyze the user's recent health summary provided below. Based on this data, generate tasks that are relevant, supportive, and address any potential areas of concern without being alarming.

If data is sparse or indicates good health, provide general wellness tasks.

Recent Health Summary:
{{{healthSummary}}}

Here are some examples of good tasks:
- If blood pressure is slightly high: "Take a 15-minute brisk walk today." (icon: Move)
- If sleep seems to be an issue: "Aim to go to bed 15 minutes earlier tonight." (icon: Bed)
- If ketone levels were high: "Drink an extra glass of water this morning." (icon: GlassWater)
- General wellness: "Spend 5 minutes stretching your body." (icon: Move)
- If user needs to monitor something: "Remember to log your urine test strip results today." (icon: Beaker)

For each task, provide a 'text' description and the most appropriate 'iconName' from the available options. The tasks should be encouraging and simple to accomplish. Create between 4 and 5 tasks.`,
});


const generateDailyTasksFlow = ai.defineFlow(
  {
    name: 'generateDailyTasksFlow',
    inputSchema: GenerateDailyTasksInputSchema,
    outputSchema: GenerateDailyTasksOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output) {
        throw new Error("The AI model did not return a valid task list.");
    }
    return output;
  }
);
