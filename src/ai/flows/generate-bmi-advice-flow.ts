
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
    advice: z.string().describe("A single, concise, and actionable health insight tailored to the user's BMI category. The tip should be encouraging, positive, and directly link the suggested action to its impact on health risks."),
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

Your task is to provide a single, actionable, and positive health insight based on their BMI category. Your response must seamlessly weave the health advice and the associated health risks into one cohesive message. The tip should be presented as a direct way to mitigate the risks.

- If 'Underweight', suggest a tip like adding protein-rich snacks, and connect it to how this helps build strength and support immune function.
- If 'Normal', offer a maintenance tip, like trying a new fun activity, and frame it as a great way to continue enjoying the health benefits of a lower risk for chronic diseases.
- If 'Overweight', suggest a small change, like swapping sugary drinks for water, and directly explain how this action helps reduce the increased risk of developing conditions like type 2 diabetes and high blood pressure.
- If 'Obese', offer a supportive first step, like a short daily walk, and explicitly link this small, consistent effort to making a big impact on lowering the significantly higher risk of serious health issues like heart disease, stroke, and type 2 diabetes.

Generate the 'advice' in the required JSON format. The tone must be supportive and empowering, making the user feel capable of making a positive change.`,
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
