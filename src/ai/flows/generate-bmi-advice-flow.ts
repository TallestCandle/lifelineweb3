
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
    advice: z.string().describe("A single, concise, and actionable health tip tailored to the user's BMI category. The tip should be encouraging and positive."),
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

Your task is to provide a single, actionable, and positive health tip based on their BMI category. Keep it brief and easy to understand.

- If 'Underweight', suggest healthy ways to gain weight, like incorporating protein-rich snacks.
- If 'Normal', give a tip for maintaining a healthy lifestyle, like trying a new physical activity.
- If 'Overweight', suggest a small, sustainable change, like swapping sugary drinks for water.
- If 'Obese', offer a supportive first step, such as aiming for a short 10-minute walk each day.

Generate the 'advice' in the required JSON format.`,
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
