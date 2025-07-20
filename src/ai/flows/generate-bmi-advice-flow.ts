
'use server';
/**
 * @fileOverview An AI agent that generates a health tip based on BMI.
 *
 * - generateBmiAdvice - Creates a health tip.
 * - GenerateBmiAdviceInput - The input type for the function.
 * - GenerateBmiAdviceOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const GenerateBmiAdviceInputSchema = z.object({
  bmi: z.number().describe("The user's calculated Body Mass Index value."),
  category: z.enum(['Underweight', 'Normal', 'Overweight', 'Obese']).describe("The health category corresponding to the BMI value."),
});
export type GenerateBmiAdviceInput = z.infer<typeof GenerateBmiAdviceInputSchema>;

const GenerateBmiAdviceOutputSchema = z.object({
    advice: z.string().describe("A single, concise, and actionable health insight tailored to the user's BMI category. The tip should be encouraging, positive, and mention potential health considerations."),
});
export type GenerateBmiAdviceOutput = z.infer<typeof GenerateBmiAdviceOutputSchema>;

export async function generateBmiAdvice(input: GenerateBmiAdviceInput): Promise<GenerateBmiAdviceOutput> {
  return generateBmiAdviceFlow(input);
}

const prompt = ai.definePrompt({
    name: 'generateBmiAdvicePrompt',
    input: { schema: GenerateBmiAdviceInputSchema },
    output: { schema: GenerateBmiAdviceOutputSchema },
    prompt: `You are a friendly and encouraging AI health coach. A user has just calculated their BMI.
    
User's BMI: {{bmi}}
BMI Category: {{category}}

Your task is to provide a single, actionable, and positive health insight based on their BMI category. The advice should be brief, easy to understand, and gently mention potential health considerations without being alarming.

- If 'Underweight', suggest healthy ways to gain weight, like incorporating protein-rich snacks, and briefly mention the importance of ensuring adequate nutrient intake for energy and immune function.
- If 'Normal', give a tip for maintaining a healthy lifestyle, like trying a new physical activity, and commend them on being in a healthy range.
- If 'Overweight', suggest a small, sustainable change, like swapping sugary drinks for water, and mention that this can help reduce strain on joints and lower blood pressure.
- If 'Obese', offer a supportive first step, such as aiming for a short 10-minute walk each day. Gently mention that consistent small efforts can significantly lower the risk of conditions like type 2 diabetes and heart disease.

Generate the 'advice' in the required JSON format. Keep the tone positive and empowering.`,
});


const generateBmiAdviceFlow = ai.defineFlow(
  {
    name: 'generateBmiAdviceFlow',
    inputSchema: GenerateBmiAdviceInputSchema,
    outputSchema: GenerateBmiAdviceOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output) {
        throw new Error("The AI model did not return valid BMI advice.");
    }
    return output;
  }
);
