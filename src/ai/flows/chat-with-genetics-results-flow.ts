
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
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

const MessageSchema = z.object({
  role: z.enum(['user', 'model']),
  content: z.string(),
});

const ChatWithGeneticsResultsInputSchema = z.object({
    analysisId: z.string().describe("The ID for the user's current analysis session."),
    userId: z.string().describe("The ID of the user."),
    chatHistory: z.array(MessageSchema).describe("The full history of the conversation so far."),
});
export type ChatWithGeneticsResultsInput = z.infer<typeof ChatWithGeneticsResultsInputSchema>;

const ChatWithGeneticsResultsOutputSchema = z.object({
    answer: z.string().describe("The AI's response to the user's question, in a helpful and conversational tone."),
});
export type ChatWithGeneticsResultsOutput = z.infer<typeof ChatWithGeneticsResultsOutputSchema>;

// Tool to fetch specific SNP data for the user's session
const getSnpDataForUser = ai.defineTool(
    {
        name: 'getSnpDataForUser',
        description: 'Fetches the annotated data for a specific SNP from the user\'s analysis results.',
        inputSchema: z.object({
            rsid: z.string().describe("The rsID of the SNP to look up, e.g., 'rs1801133'."),
            analysisId: z.string().describe("The ID of the analysis session."),
            userId: z.string().describe("The ID of the user."),
        }),
        outputSchema: z.any(),
    },
    async (input) => {
        const { rsid, analysisId, userId } = input;
        
        const snpDocRef = doc(db, `users/${userId}/genetic_analyses/${analysisId}/results`, rsid);
        const docSnap = await getDoc(snpDocRef);

        if (docSnap.exists()) {
            return docSnap.data();
        } else {
            return `SNP with ID ${rsid} was not found in this user's analysis results.`;
        }
    }
);


export async function chatWithGeneticsResults(input: ChatWithGeneticsResultsInput): Promise<ChatWithGeneticsResultsOutput> {
  return chatWithGeneticsResultsFlow(input);
}

const prompt = ai.definePrompt({
    name: 'chatWithGeneticsResultsPrompt',
    model: googleAI.model('gemini-1.5-pro'),
    input: { schema: ChatWithGeneticsResultsInputSchema },
    output: { schema: ChatWithGeneticsResultsOutputSchema },
    tools: [getSnpDataForUser],
    prompt: `You are an expert genetics counselor AI from Lifeline AI. Your role is to answer a user's questions about their annotated SNP results in a clear, educational, and safe manner.

**CRITICAL RULES:**
1.  **NO MEDICAL ADVICE:** Under no circumstances should you provide a medical diagnosis, predict disease risk, or give advice that could be interpreted as medical.
2.  **EDUCATIONAL TONE:** Frame all interpretations in terms of predispositions, traits, or how the body might process something. Use phrases like "this variant is associated with," "some studies suggest," or "it may influence."
3.  **USE YOUR TOOLS:** To answer a question about a specific SNP, you MUST use the \`getSnpDataForUser\` tool to look up its details from the user's results. You must pass the 'analysisId' and 'userId' to the tool, which are provided below. Do not invent information or discuss SNPs you haven't looked up.
4.  **SAFETY FIRST:** For any health-related question, your answer MUST include a sentence encouraging the user to speak with a healthcare professional or a qualified genetic counselor for personal advice.

**CONTEXT:**
- User ID: {{userId}}
- Analysis Session ID: {{analysisId}}

**CONVERSATION HISTORY:**
{{#each chatHistory}}
{{this.role}}: {{this.content}}
{{/each}}

**YOUR TASK:**
Based on the conversation history and the provided context, answer the latest user question. Use the \`getSnpDataForUser\` tool with the correct \`userId\` and \`analysisId\` to get the information needed to form your answer.`,
});

const chatWithGeneticsResultsFlow = ai.defineFlow(
  {
    name: 'chatWithGeneticsResultsFlow',
    inputSchema: ChatWithGeneticsResultsInputSchema,
    outputSchema: ChatWithGeneticsResultsOutputSchema,
  },
  async (input) => {
    // No longer need to pass context, it's now part of the main prompt input.
    const { output } = await prompt(input);
    
    if (!output) {
        throw new Error("The AI model did not return a valid response.");
    }
    return output;
  }
);
