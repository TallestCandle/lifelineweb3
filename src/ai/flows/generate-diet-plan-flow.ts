
'use server';
/**
 * @fileOverview An AI agent that generates personalized dietary advice.
 *
 * - generateDietPlan - Creates dietary advice based on health data.
 * - GenerateDietPlanInput - The input type for the function.
 * - GenerateDietPlanOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const GenerateDietPlanInputSchema = z.object({
  healthSummary: z.string().describe("A JSON string of recent health data including vitals (e.g., blood pressure, blood sugar), test strip results, and previous AI analyses."),
  previousPlan: z.string().optional().describe("A JSON string of the previous dietary advice, if any. The new advice should be different from this one."),
}).describe("A summary of the user's recent health data and optionally the previous plan to ensure variety.");

export type GenerateDietPlanInput = z.infer<typeof GenerateDietPlanInputSchema>;

const FoodSuggestionSchema = z.object({
    name: z.string().describe("The name of the food or food category. Be specific, e.g., 'Oily & Fried Foods', 'Sugary Drinks', 'Leafy Greens', 'Unripe Plantain'."),
    reason: z.string().describe("A brief, clear reason why this is recommended or should be avoided based on the user's health data."),
});

const GenerateDietPlanOutputSchema = z.object({
    foodsToAvoid: z.array(FoodSuggestionSchema).describe("A list of 3-5 foods or food categories the user should avoid."),
    recommendedFoods: z.array(FoodSuggestionSchema).describe("A list of 3-5 foods or food categories that are beneficial for the user."),
    generalAdvice: z.array(z.string()).describe("A list of 3-4 general, actionable dietary tips based on the user's health profile. For example: 'Drink at least 8 glasses of water daily.' or 'Practice portion control for all meals.'"),
});

export type GenerateDietPlanOutput = z.infer<typeof GenerateDietPlanOutputSchema>;

export async function generateDietPlan(input: GenerateDietPlanInput): Promise<GenerateDietPlanOutput> {
  return generateDietPlanFlow(input);
}

const prompt = ai.definePrompt({
    name: 'generateDietPlanPrompt',
    input: { schema: GenerateDietPlanInputSchema },
    output: { schema: GenerateDietPlanOutputSchema },
    prompt: `You are an expert dietician and nutritionist from Lifeline AI, specializing in creating personalized dietary guidelines based on an individual's health data. You have deep knowledge of both traditional Nigerian cuisine and general intercontinental dishes.

Your task is to analyze the user's recent health summary to create a list of foods to avoid and a list of recommended foods, along with general advice. DO NOT create a full day meal plan (breakfast, lunch, dinner).

**User Health Data:**
- Health Summary: {{{healthSummary}}}
{{#if previousPlan}}
- Previous Plan: {{{previousPlan}}}
  **Very Important:** The new advice you generate MUST be different from the previous plan provided. Offer new and creative suggestions to ensure variety for the user. Do not repeat items from the previous plan.
{{/if}}

**Instructions:**
1.  **Analyze the Data:** Carefully review the health summary. Look for indicators like high blood pressure, high blood sugar, elevated weight, or abnormal urine test results.
2.  **Create Food Lists:**
    -   **foodsToAvoid:** Create a list of 3-5 specific food types or categories the user should avoid. For each, provide a concise 'reason' explaining why it's detrimental based on their health data (e.g., for 'Sugary Drinks' the reason could be 'They can cause sharp spikes in your blood sugar levels.').
    -   **recommendedFoods:** Create a list of 3-5 specific foods or food categories that would be beneficial. For each, provide a concise 'reason' explaining its health benefit (e.g., for 'Leafy Greens' the reason could be 'They are rich in vitamins and minerals and low in calories, which helps with weight management.').
    -   Incorporate a mix of Nigerian and intercontinental options where appropriate.
3.  **Provide General Advice:** Give 3-4 bullet points of clear, simple, and actionable dietary advice. Be direct, e.g., "Avoid oily foods," "Drink more water," or "Reduce your salt intake." If the health data shows significant issues (e.g., very high blood pressure, uncontrolled blood sugar), one of your 'generalAdvice' points MUST be to 'Discuss this dietary advice with a doctor. You can create a case in the Clinic to start a consultation.'

Generate the response in the required JSON format.`,
});


const generateDietPlanFlow = ai.defineFlow(
  {
    name: 'generateDietPlanFlow',
    inputSchema: GenerateDietPlanInputSchema,
    outputSchema: GenerateDietPlanOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output) {
        throw new Error("The AI model did not return a valid diet plan.");
    }
    return output;
  }
);
