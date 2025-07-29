
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
import { db } from '@/lib/firebase';
import { collection, doc, getDoc } from "firebase/firestore";

const MessageSchema = z.object({
  role: z.enum(['user', 'model']),
  content: z.string(),
});

// Zod schema for the tool's output
const SnpDataSchema = z.object({
  id: z.string(),
  most_severe_consequence: z.string(),
  gene: z.string().optional(),
  transcriptId: z.string().optional(),
});

// Tool for the AI to fetch specific SNP data from the user's analysis results.
const getSnpDataForUser = ai.defineTool(
  {
    name: 'getSnpDataForUser',
    description: 'Fetches the annotated data for a specific SNP (by rsID) from the results of a specific user analysis session.',
    inputSchema: z.object({
      userId: z.string().describe("The user's unique ID."),
      analysisId: z.string().describe("The ID of the analysis session."),
      rsid: z.string().describe("The rsID of the SNP to look up (e.g., 'rs699')."),
    }),
    outputSchema: SnpDataSchema.nullable(),
  },
  async ({ userId, analysisId, rsid }) => {
    if (!userId || !analysisId || !rsid) {
        return null;
    }
    const resultDocRef = doc(db, `users/${userId}/genetic_analyses/${analysisId}/results`, rsid);
    const docSnap = await getDoc(resultDocRef);
    if (docSnap.exists()) {
        return docSnap.data() as z.infer<typeof SnpDataSchema>;
    }
    return null;
  }
);


const ChatWithGeneticsResultsInputSchema = z.object({
  userId: z.string(),
  analysisId: z.string(),
  chatHistory: z.array(MessageSchema),
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
  tools: [getSnpDataForUser],
  prompt: `You are an expert genetics counselor AI. Your role is to help a user understand their genetic analysis results in a clear, educational, and safe manner.

**CRITICAL RULES:**
1.  **NO MEDICAL ADVICE:** You must NEVER provide a medical diagnosis, predict disease, or give any advice that could be interpreted as medical guidance. Always steer the conversation towards education about genetics.
2.  **USE YOUR TOOL:** When the user asks about a specific SNP (e.g., "What about rs1801133?" or "Tell me about my MTHFR gene"), you MUST use the \`getSnpDataForUser\` tool to fetch their specific data. You MUST provide the \`userId\`, \`analysisId\`, and the \`rsid\` to the tool.
3.  **BE CONVERSATIONAL:** Answer in a friendly, helpful, and easy-to-understand way. Avoid overly technical jargon.
4.  **SAFETY FIRST:** If the user asks about a sensitive health topic, gently remind them that this is for educational purposes only and they should consult a healthcare provider for medical concerns.

The user's ID is {{userId}} and the current analysis ID is {{analysisId}}. Use these when you call your tool.

**Conversation History:**
{{#each chatHistory}}
{{this.role}}: {{this.content}}
{{/each}}

Based on the conversation, provide a helpful 'answer' to the user's latest message.`,
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
