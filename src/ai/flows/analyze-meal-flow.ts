
'use server';
/**
 * @fileOverview An AI agent that provides nutritional analysis and feedback on a user's meal.
 *
 * - analyzeMeal - Analyzes a user's meal description and provides feedback.
 * - AnalyzeMealInput - The input type for the analyzeMeal function.
 * - AnalyzeMealOutput - The return type for the analyzeMeal function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const AnalyzeMealInputSchema = z.object({
  mealDescription: z.string().describe("A user's description of a meal they have eaten. e.g., 'I had jollof rice with fried chicken and plantain.'"),
  userHealthContext: z.string().describe("A brief summary of the user's known health conditions or goals, e.g., 'User has Chronic Kidney Disease (CKD) Stage 3' or 'User is trying to manage type 2 diabetes.'"),
  imageDataUri: z.string().optional().describe("An optional photo of the meal, provided as a data URI. This serves as visual context for the analysis."),
}).describe("A user's meal information for nutritional analysis.");

export type AnalyzeMealInput = z.infer<typeof AnalyzeMealInputSchema>;


const FoodComponentSchema = z.object({
  name: z.string().describe("The name of the food item or ingredient."),
  isHealthy: z.boolean().describe("Whether this component is generally considered healthy for the user's context."),
  reason: z.string().describe("A brief, clear reason for the health assessment (healthy or unhealthy)."),
});

const AnalyzeMealOutputSchema = z.object({
    overallAssessment: z.string().describe("A one-sentence overall assessment of the meal's healthiness for the user."),
    healthScore: z.number().int().min(1).max(100).describe("A score from 1-100 representing how healthy the meal is for the user's specific context. 1 is very unhealthy, 100 is ideal."),
    mainComponents: z.array(FoodComponentSchema).describe("A breakdown of the main food components identified in the meal, with a health assessment for each."),
    healthierAlternative: z.string().describe("A specific, actionable suggestion for a healthier version of this meal."),
    healthTips: z.array(z.string()).describe("A list of 2-3 general health or dietary tips related to the user's meal and health context."),
});
export type AnalyzeMealOutput = z.infer<typeof AnalyzeMealOutputSchema>;

export async function analyzeMeal(input: AnalyzeMealInput): Promise<AnalyzeMealOutput> {
  return analyzeMealFlow(input);
}

const prompt = ai.definePrompt({
    name: 'analyzeMealPrompt',
    input: { schema: AnalyzeMealInputSchema },
    output: { schema: AnalyzeMealOutputSchema },
    prompt: `You are an expert AI Dietician specializing in analyzing meals for patients with specific health conditions, such as Chronic Kidney Disease (CKD), diabetes, and hypertension. Your advice must be practical, culturally aware (especially regarding Nigerian cuisine), and empathetic.

**Analysis Task:**
Analyze the user's meal based on their description and health context. Provide a detailed, structured analysis.

**User Health Context:**
{{{userHealthContext}}}

**User's Meal Description:**
"{{{mealDescription}}}"

{{#if imageDataUri}}
**Meal Photo (for visual context):**
{{media url=imageDataUri}}
{{/if}}

**Instructions:**
1.  **Deconstruct the Meal:** Break down the 'mealDescription' into its main food components (e.g., 'Jollof Rice', 'Fried Chicken', 'Plantain').
2.  **Assess Each Component:** For each component, evaluate its health impact based on the 'userHealthContext'. Is it healthy or unhealthy for them? Why? Be specific. For a CKD patient, this means focusing on sodium, potassium, and phosphorus. For a diabetic patient, focus on carbohydrates and sugar.
3.  **Calculate Health Score:** Based on your analysis, provide a 'healthScore' from 1 to 100. A score of 100 is perfectly aligned with the user's health needs, while a score of 1 is extremely detrimental.
4.  **Provide Overall Assessment:** Write a single, concise 'overallAssessment' sentence.
5.  **Suggest Alternatives:** Offer a concrete, 'healthierAlternative' to the meal. For example, "Next time, consider baked or grilled chicken instead of fried, and have boiled plantains instead of fried ones."
6.  **Offer Tips:** Provide 2-3 general 'healthTips' that are relevant to the meal and the user's condition.

Your entire response MUST be in the specified JSON format.`,
});


const analyzeMealFlow = ai.defineFlow(
  {
    name: 'analyzeMealFlow',
    inputSchema: AnalyzeMealInputSchema,
    outputSchema: AnalyzeMealOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output) {
        throw new Error("The AI model did not return a valid meal analysis.");
    }
    return output;
  }
);
