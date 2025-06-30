
'use server';
/**
 * @fileOverview An AI agent that generates a personalized daily diet plan.
 *
 * - generateDietPlan - Creates a daily meal plan based on health data.
 * - GenerateDietPlanInput - The input type for the function.
 * - GenerateDietPlanOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const GenerateDietPlanInputSchema = z.object({
  healthSummary: z.string().describe("A JSON string of recent health data including vitals (e.g., blood pressure, blood sugar), test strip results, and previous AI analyses."),
}).describe("A summary of the user's recent health data.");

export type GenerateDietPlanInput = z.infer<typeof GenerateDietPlanInputSchema>;

const MealSchema = z.object({
    meal: z.string().describe("The name of the recommended meal. Be specific, e.g., 'Jollof Rice with Grilled Chicken Breast' or 'Oatmeal with Berries and Nuts'."),
    reason: z.string().describe("A brief, clear reason why this meal is recommended for the user based on their health data."),
});

const GenerateDietPlanOutputSchema = z.object({
    breakfast: MealSchema,
    lunch: MealSchema,
    dinner: MealSchema,
    generalAdvice: z.array(z.string()).describe("A list of 3-4 general, actionable dietary tips based on the user's health profile. For example: 'Avoid sugary drinks and processed snacks.' or 'Limit your intake of oily and fried foods to help manage blood pressure.'"),
});

export type GenerateDietPlanOutput = z.infer<typeof GenerateDietPlanOutputSchema>;

export async function generateDietPlan(input: GenerateDietPlanInput): Promise<GenerateDietPlanOutput> {
  return generateDietPlanFlow(input);
}

const prompt = ai.definePrompt({
    name: 'generateDietPlanPrompt',
    input: { schema: GenerateDietPlanInputSchema },
    output: { schema: GenerateDietPlanOutputSchema },
    prompt: `You are an expert dietician and nutritionist from Lifeline AI, specializing in creating personalized daily meal plans based on an individual's health data. You have deep knowledge of both traditional Nigerian cuisine and general intercontinental dishes.

Your task is to analyze the user's recent health summary to create a one-day meal plan (breakfast, lunch, dinner) and provide some general dietary advice.

**User Health Data:**
- Health Summary: {{{healthSummary}}}

**Instructions:**
1.  **Analyze the Data:** Carefully review the health summary. Look for indicators like high blood pressure, high blood sugar, elevated weight, or abnormal urine test results.
2.  **Create Meal Plan:** Suggest one specific, healthy meal for breakfast, lunch, and dinner.
    -   If the data suggests health issues (e.g., high blood pressure), recommend meals that help manage it (e.g., low-sodium, high-fiber meals). For instance, recommend 'Boiled Yam with Garden Egg Sauce' instead of fried foods.
    -   If the data suggests good health, recommend a balanced, nutritious meal.
    -   Incorporate a mix of Nigerian and intercontinental options where appropriate.
    -   For each meal, provide a concise 'reason' explaining its benefit in relation to the user's health data.
3.  **Provide General Advice:** Give 3-4 bullet points of clear, simple, and actionable dietary advice. Be direct, e.g., "Avoid oily foods," "Drink more water," or "Reduce your salt intake." If the health data shows significant issues (e.g., very high blood pressure, uncontrolled blood sugar), one of your 'generalAdvice' points MUST be to 'Discuss this dietary plan with a doctor. You can book an appointment in the app.'

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
