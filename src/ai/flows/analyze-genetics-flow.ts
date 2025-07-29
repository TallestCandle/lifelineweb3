
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
    interpretation: z.string().describe("A clear, direct interpretation of the genotype, including any known medical risks (good or bad) or health implications. This information should be comprehensive and not withhold potential negative findings."),
});

const AnalyzeGeneticsOutputSchema = z.object({
    ancestryTraits: z.array(GeneticMarkerSchema).describe("Analysis of traits related to ancestry and physical characteristics (e.g., eye color, hair type)."),
    healthMarkers: z.array(GeneticMarkerSchema).describe("Analysis of general wellness markers related to diet, fitness, and common health predispositions."),
    vitaminMetabolism: z.array(GeneticMarkerSchema).describe("Analysis of genes related to how the body processes or metabolizes certain vitamins (e.g., Vitamin B12, Vitamin D)."),
    drugResponse: z.array(GeneticMarkerSchema).describe("Analysis of common genes known to influence response to certain drugs (e.g., caffeine, statins)."),
    summaryDisclaimer: z.string().describe("A concluding paragraph that summarizes the findings and provides a strong disclaimer. This MUST state that the information is for research and informational purposes ONLY, is not a medical diagnosis, and that a qualified healthcare provider and genetic counselor should be consulted before making any decisions based on this data."),
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
    prompt: `You are an expert bioinformatician AI. Your role is to analyze a user's raw DNA data and provide a direct, unfiltered interpretation of the genetic markers found.

**CRITICAL RULES:**
1.  **DIRECT INTERPRETATION:** Provide a direct and clear interpretation for each marker. If a marker is associated with a medical risk (positive or negative), you must state it clearly. Do not withhold information.
2.  **FACTUAL & UNBIASED:** Your analysis must be based on established scientific research. Present the information factually.
3.  **COMPREHENSIVE ANALYSIS:** Scan the user's data for the specified markers and provide a complete analysis for each category.

**USER'S RAW DNA DATA:**
\`\`\`
{{{dnaData}}}
\`\`\`

**ANALYSIS TASK:**
Analyze the provided raw DNA data. Scan for common, well-researched Single Nucleotide Polymorphisms (SNPs) and genes. Populate the following four categories with your findings. For each finding, provide the marker name, the user's genotype, and a direct interpretation of what that genotype implies, including any associated risks.

1.  **ancestryTraits:** Look for markers related to physical traits. Examples:
    *   HERC2/OCA2 for eye color.
    *   EDAR for hair thickness.
    *   MC1R for red hair/fair skin.
2.  **healthMarkers:** Look for markers related to general wellness and disease risk. Examples:
    *   LCT gene for lactose intolerance.
    *   FTO gene variants associated with obesity risk.
    *   ACTN3 for athletic performance type.
    *   APOE variants for Alzheimer's risk.
3.  **vitaminMetabolism:** Look for markers related to vitamin processing. Examples:
    *   MTHFR variants and folate metabolism.
    *   BCMO1 variants and beta-carotene (Vitamin A) conversion.
    *   GC/VDR variants and Vitamin D pathways.
4.  **drugResponse:** Look for common pharmacogenomic markers. Examples:
    *   CYP1A2 and caffeine metabolism speed.
    *   SLCO1B1 and risk for statin-induced myopathy.
    *   CYP2C19 and response to clopidogrel (Plavix).

Finally, write a 'summaryDisclaimer'. It must clearly state: "This is an AI-generated analysis of raw genetic data for informational and research purposes only. It is NOT a medical diagnosis or medical advice. Genetic information is complex and this report does not encompass all factors influencing health and disease. You MUST consult with a qualified healthcare provider and a genetic counselor before making any health-related decisions."

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
