
'use server';
/**
 * @fileOverview An AI agent for analyzing raw genetic data for wellness and ancestry insights.
 *
 * - analyzeGenetics - A function that handles the genetic data analysis process.
 * - AnalyzeGeneticsInput - The input type for the function.
 * - AnalyzeGeneticsOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { googleAI } from '@genkit-ai/googleai';

const AnalyzeGeneticsInputSchema = z.object({
  dnaData: z.string().describe("The raw DNA data as a string, typically from a .txt file provided by services like 23andMe or AncestryDNA."),
});
export type AnalyzeGeneticsInput = z.infer<typeof AnalyzeGeneticsInputSchema>;

const GeneticMarkerSchema = z.object({
    marker: z.string().describe("The name of the genetic marker or gene (e.g., 'Lactose Intolerance', 'CYP1A2', 'MTHFR')."),
    genotype: z.string().describe("The user's specific genotype for this marker (e.g., 'C/C', 'A/G')."),
    interpretation: z.string().describe("A clear, simple, and educational interpretation of the genotype. This MUST NOT be medical advice. It should focus on wellness, traits, or predispositions in non-clinical terms."),
});

const AnalyzeGeneticsOutputSchema = z.object({
    ancestryTraits: z.array(GeneticMarkerSchema).describe("Analysis of traits related to ancestry and physical characteristics (e.g., eye color, hair type)."),
    healthMarkers: z.array(GeneticMarkerSchema).describe("Analysis of general wellness markers related to diet, fitness, and common health predispositions."),
    vitaminMetabolism: z.array(GeneticMarkerSchema).describe("Analysis of genes related to how the body processes or metabolizes certain vitamins (e.g., Vitamin B12, Vitamin D)."),
    drugResponse: z.array(GeneticMarkerSchema).describe("Analysis of common genes known to influence response to certain drugs (e.g., caffeine, statins)."),
    summaryDisclaimer: z.string().describe("A concluding paragraph that summarizes the findings in a positive tone and strongly reiterates that this is not a medical diagnosis and results should be discussed with a healthcare provider before making any health decisions."),
});

export type AnalyzeGeneticsOutput = z.infer<typeof AnalyzeGeneticsOutputSchema>;

export async function analyzeGenetics(input: AnalyzeGeneticsInput): Promise<AnalyzeGeneticsOutput> {
  return analyzeGeneticsFlow(input);
}

const prompt = ai.definePrompt({
    name: 'analyzeGeneticsPrompt',
    model: googleAI.model('gemini-1.5-pro'), // Use a model with a larger context window
    input: { schema: AnalyzeGeneticsInputSchema },
    output: { schema: AnalyzeGeneticsOutputSchema },
    prompt: `You are a genetics expert AI assistant from Lifeline AI. Your role is to analyze a user's raw DNA data for educational and wellness purposes only.

**CRITICAL RULES:**
1.  **NO MEDICAL ADVICE:** Under no circumstances should you provide a medical diagnosis, predict disease risk, or give advice that could be interpreted as medical.
2.  **EDUCATIONAL TONE:** Frame all interpretations in terms of predispositions, traits, or how the body might process something. Use phrases like "likely to have," "may process differently," or "associated with."
3.  **PLAIN ENGLISH:** Explain complex genetic concepts in a simple, easy-to-understand way.
4.  **SAFETY FIRST:** For any health or drug-related marker, the interpretation MUST include a sentence encouraging the user to speak with a healthcare professional before making any decisions.

**USER'S RAW DNA DATA:**
\`\`\`
{{{dnaData}}}
\`\`\`

**ANALYSIS TASK:**
Analyze the provided raw DNA data. Scan for common, well-researched Single Nucleotide Polymorphisms (SNPs) and genes. Populate the following four categories with your findings. For each finding, provide the marker name, the user's genotype, and a safe, educational interpretation.

1.  **ancestryTraits:** Look for markers related to physical traits. Examples:
    *   HERC2/OCA2 for eye color.
    *   EDAR for hair thickness.
    *   MC1R for red hair/fair skin.
2.  **healthMarkers:** Look for markers related to general wellness. Examples:
    *   LCT gene for lactose intolerance.
    *   FTO gene variants associated with metabolism and appetite.
    *   ACTN3 for athletic performance type (endurance vs. power).
3.  **vitaminMetabolism:** Look for markers related to vitamin processing. Examples:
    *   MTHFR variants and folate metabolism.
    *   BCMO1 variants and beta-carotene (Vitamin A) conversion.
    *   GC/VDR variants and Vitamin D pathways.
4.  **drugResponse:** Look for common pharmacogenomic markers. Examples:
    *   CYP1A2 and caffeine metabolism speed.
    *   SLCO1B1 and response to statins.
    *   CYP2C19 and response to clopidogrel (Plavix).

Finally, write a 'summaryDisclaimer' that wraps up the findings positively and includes a strong disclaimer that these are not medical results and a doctor should be consulted for health decisions.

Generate the entire response in the required JSON format.`,
});

const analyzeGeneticsFlow = ai.defineFlow(
  {
    name: 'analyzeGeneticsFlow',
    inputSchema: AnalyzeGeneticsInputSchema,
    outputSchema: AnalyzeGeneticsOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output) {
        throw new Error("The AI model did not return a valid genetics analysis.");
    }
    return output;
  }
);
