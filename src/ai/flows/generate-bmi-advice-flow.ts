
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

Your task is to provide a single, actionable, and positive health insight based on their BMI category. The advice MUST be direct about potential health risks while remaining supportive.

- If 'Underweight', suggest healthy ways to gain weight, like incorporating protein-rich snacks, and briefly mention the importance of ensuring adequate nutrient intake for energy and immune function.
- If 'Normal', give a tip for maintaining a healthy lifestyle, like trying a new physical activity, and commend them on being in a healthy range which reduces risks for chronic diseases.
- If 'Overweight', suggest a small, sustainable change, like swapping sugary drinks for water. You MUST explicitly state that this category is associated with an increased risk of developing conditions like type 2 diabetes, high blood pressure, and heart disease. Frame the tip as a positive step towards reducing these risks.
- If 'Obese', offer a supportive first step, such as aiming for a short 10-minute walk each day. You MUST explicitly state that this category is associated with a significantly higher risk of serious health issues including type 2 diabetes, heart disease, stroke, and certain types of cancer. Emphasize that small, consistent efforts can make a big impact on lowering these serious risks.

Generate the 'advice' in the required JSON format. Keep the tone positive and empowering, but do not hide the risks.`,
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
