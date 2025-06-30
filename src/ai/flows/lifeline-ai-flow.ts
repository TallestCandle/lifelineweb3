
'use server';
/**
 * @fileOverview A general-purpose health AI assistant for the public landing page.
 *
 * - askLifeline - A function that answers general health questions.
 * - AskLifelineInput - The input type for the askLifeline function.
 * - AskLifelineOutput - The return type for the askLifeline function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const AskLifelineInputSchema = z.object({
  query: z.string().describe("A general health-related question from a user."),
});
export type AskLifelineInput = z.infer<typeof AskLifelineInputSchema>;

const AskLifelineOutputSchema = z.object({
  answer: z.string().describe("A clear, helpful, and concise answer to the user's question."),
  disclaimer: z.string().describe("A standard disclaimer stating that this is not medical advice."),
});
export type AskLifelineOutput = z.infer<typeof AskLifelineOutputSchema>;

export async function askLifeline(input: AskLifelineInput): Promise<AskLifelineOutput> {
  return lifelineAiFlow(input);
}

const prompt = ai.definePrompt({
  name: 'askLifelinePrompt',
  input: { schema: AskLifelineInputSchema },
  output: { schema: AskLifelineOutputSchema },
  prompt: `You are Lifeline AI, a helpful and friendly AI assistant for the Lifeline AI health tech app. Your purpose is to provide general health information to users on the public landing page.

You must follow these rules strictly:
1.  **NEVER PROVIDE A DIAGNOSIS.** Do not diagnose, treat, or give prescriptive medical advice. Your role is purely informational.
2.  **BE CLEAR AND SIMPLE.** Avoid overly technical jargon. Explain concepts in a way that is easy for anyone to understand.
3.  **PROMOTE PROFESSIONAL CONSULTATION.** Always encourage users to speak with a healthcare professional for personal medical advice.
4.  **ALWAYS INCLUDE THE DISCLAIMER.** The 'disclaimer' field in your output must always be: "This is AI-generated information and not a substitute for professional medical advice. Always consult with a qualified healthcare provider for any health concerns."

User's Question:
"{{{query}}}"

Based on this question, generate a helpful and safe answer, and provide the mandatory disclaimer in the required JSON format.`,
  config: {
    safetySettings: [
        {
          category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
          threshold: 'BLOCK_ONLY_HIGH',
        },
        {
          category: 'HARM_CATEGORY_HARASSMENT',
          threshold: 'BLOCK_MEDIUM_AND_ABOVE',
        },
        {
          category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
          threshold: 'BLOCK_MEDIUM_AND_ABOVE',
        }
    ]
  }
});

const lifelineAiFlow = ai.defineFlow(
  {
    name: 'lifelineAiFlow',
    inputSchema: AskLifelineInputSchema,
    outputSchema: AskLifelineOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output) {
      throw new Error("The AI model did not return a valid response.");
    }
    // Ensure the disclaimer is always correct, overriding whatever the model might have sent.
    output.disclaimer = "This is AI-generated information and not a substitute for professional medical advice. Always consult with a qualified healthcare provider for any health concerns.";
    return output;
  }
);
