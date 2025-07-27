
'use server';
/**
 * @fileOverview An AI agent for discussing a user's genetics results.
 *
 * - chatWithGeneticsResults - A function that handles the chat interaction.
 * - ChatWithGeneticsResultsInput - The input type for the function.
 * - ChatWithGeneticsResultsOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { googleAI } from '@genkit-ai/googleai';

const MessageSchema = z.object({
  role: z.enum(['user', 'model']),
  content: z.string(),
});

const ChatWithGeneticsResultsInputSchema = z.object({
    chatHistory: z.array(MessageSchema).describe("The full history of the conversation so far."),
    snpResultsJson: z.string().describe("A JSON string representing the user's annotated SNP results that are the context for this conversation."),
});
export type ChatWithGeneticsResultsInput = z.infer<typeof ChatWithGeneticsResultsInputSchema>;

const ChatWithGeneticsResultsOutputSchema = z.object({
    answer: z.string().describe("The AI's response to the user's question, in a helpful and conversational tone."),
});
export type ChatWithGeneticsResultsOutput = z.infer<typeof ChatWithGeneticsResultsOutputSchema>;

export async function chatWithGeneticsResults(input: ChatWithGeneticsResultsInput): Promise<ChatWithGeneticsResultsOutput> {
  return chatWithGeneticsResultsFlow(input);
}

const prompt = ai.definePrompt({
    name: 'chatWithGeneticsResultsPrompt',
    model: googleAI.model('gemini-1.5-pro'),
    input: { schema: ChatWithGeneticsResultsInputSchema },
    output: { schema: ChatWithGeneticsResultsOutputSchema },
    prompt: `You are an expert genetics counselor AI from Lifeline AI. Your role is to answer a user's questions about their annotated SNP results in a clear, educational, and safe manner.

**CRITICAL RULES:**
1.  **NO MEDICAL ADVICE:** Under no circumstances should you provide a medical diagnosis, predict disease risk, or give advice that could be interpreted as medical.
2.  **EDUCATIONAL TONE:** Frame all interpretations in terms of predispositions, traits, or how the body might process something. Use phrases like "this variant is associated with," "some studies suggest," or "it may influence."
3.  **STAY IN SCOPE:** Your answers MUST be based *only* on the provided SNP results and the chat history. Do not invent information or discuss SNPs not present in the provided data.
4.  **SAFETY FIRST:** For any health-related question, your answer MUST include a sentence encouraging the user to speak with a healthcare professional or a qualified genetic counselor for personal advice.

**CONTEXT - USER'S ANNOTATED SNP RESULTS (JSON):**
\`\`\`json
{{{snpResultsJson}}}
\`\`\`

**CONVERSATION HISTORY:**
{{#each chatHistory}}
{{this.role}}: {{this.content}}
{{/each}}

**YOUR TASK:**
Based on the provided SNP results and the ongoing conversation, answer the latest user question. Your response should be helpful, clear, and strictly adhere to the safety rules.
`,
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
