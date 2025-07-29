
'use server';
/**
 * @fileOverview An AI agent for having a conversation about genetics results.
 *
 * - chatWithGeneticsResults - A function that handles the conversation.
 * - ChatWithGeneticsResultsInput - The input type for the function.
 * - ChatWithGeneticsResultsOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import type { SnpLookupResult } from '@/app/actions/snp-lookup-action';

const MessageSchema = z.object({
  role: z.enum(['user', 'model']),
  content: z.string(),
});

const ChatWithGeneticsResultsInputSchema = z.object({
  chatHistory: z.array(MessageSchema),
  annotatedSnps: z.string().describe("A JSON string representing the user's annotated SNP results from their analysis."),
});
export type ChatWithGeneticsResultsInput = z.infer<typeof ChatWithGeneticsResultsInputSchema>;

const ChatWithGeneticsResultsOutputSchema = z.object({
  answer: z.string(),
});
export type ChatWithGeneticsResultsOutput = z.infer<typeof ChatWithGeneticsResultsOutputSchema>;

export async function chatWithGeneticsResults(input: ChatWithGeneticsResultsInput): Promise<ChatWithGeneticsResultsOutput> {
  return chatWithGeneticsResultsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'chatWithGeneticsResultsPrompt',
  input: { schema: ChatWithGeneticsResultsInputSchema },
  output: { schema: ChatWithGeneticsResultsOutputSchema },
  prompt: `You are an expert genetics counselor AI. Your role is to help a user understand their genetic analysis results in a clear, educational, and safe manner.

**CRITICAL RULES:**
1.  **NO MEDICAL ADVICE:** You must NEVER provide a medical diagnosis, predict disease, or give any advice that could be interpreted as medical guidance. Always steer the conversation towards education about genetics.
2.  **USE PROVIDED DATA:** All of your answers MUST come from the annotated SNP data provided below. Do not invent information or use external knowledge.
3.  **BE CONVERSATIONAL:** Answer in a friendly, helpful, and easy-to-understand way. Avoid overly technical jargon.
4.  **SAFETY FIRST:** If the user asks about a sensitive health topic, gently remind them that this is for educational purposes only and they should consult a healthcare provider for medical concerns.

**User's Annotated SNP Data (Your knowledge base):**
\`\`\`json
{{{annotatedSnps}}}
\`\`\`

**Conversation History:**
{{#each chatHistory}}
{{this.role}}: {{this.content}}
{{/each}}

Based on the conversation and the provided SNP data, provide a helpful 'answer' to the user's latest message.`,
});

const chatWithGeneticsResultsFlow = ai.defineFlow(
  {
    name: 'chatWithGeneticsResultsFlow',
    inputSchema: ChatWithGeneticsResultsInputSchema,
    outputSchema: ChatWithGeneticsResultsOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output) {
      throw new Error("The AI model did not return a valid response.");
    }
    return output;
  }
);
