
'use server';
/**
 * @fileOverview An AI agent for validating user-provided SNP data against public databases.
 *
 * - validateSnp - A function that handles the SNP validation process.
 * - ValidateSnpInput - The input type for the function.
 * - ValidateSnpOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { lookupSnp, type SnpLookupResult } from '@/app/actions/snp-lookup-action';

// Define the tool for the AI to use.
const lookupSnpDataTool = ai.defineTool(
  {
    name: 'lookupSnpData',
    description: 'Fetches verified SNP data from authoritative public databases (Ensembl, dbSNP, ClinVar) based on an rsID. Returns all available annotations for that SNP.',
    inputSchema: z.object({ rsid: z.string().describe("The rsID of the SNP to look up, e.g., 'rs699'.") }),
    outputSchema: z.array(z.custom<SnpLookupResult>()),
  },
  async (input) => {
    // This tool directly calls our existing server action logic.
    return await lookupSnp(input.rsid);
  }
);


const ValidationResultSchema = z.object({
    isValid: z.boolean().describe("True if the provided data matches the database, false otherwise."),
    databaseValue: z.string().describe("The correct value from the database."),
    explanation: z.string().describe("A clear explanation of the finding, especially if there is a mismatch. If a match, confirm it."),
});

export const ValidateSnpInputSchema = z.object({
  snpId: z.string().describe("The user's provided SNP ID (rsID)."),
  consequence: z.string().describe("The user's provided consequence."),
  gene: z.string().optional().describe("The user's provided gene."),
  aminoAcidChange: z.string().optional().describe("The user's provided amino acid change."),
  codonChange: z.string().optional().describe("The user's provided codon change."),
  transcript: z.string().optional().describe("The user's provided transcript ID."),
  clinicalSignificance: z.string().optional().describe("The user's provided clinical significance."),
});
export type ValidateSnpInput = z.infer<typeof ValidateSnpInputSchema>;

export const ValidateSnpOutputSchema = z.object({
  overallAssessment: z.enum(['Correct', 'Incorrect', 'Partially Correct', 'Not Found']).describe("A single overall assessment of the provided data."),
  validationDetails: z.object({
    snpId: ValidationResultSchema,
    consequence: ValidationResultSchema,
    gene: ValidationResultSchema,
    aminoAcidChange: ValidationResultSchema,
    codonChange: ValidationResultSchema,
    transcript: ValidationResultSchema,
    clinicalSignificance: ValidationResultSchema,
  }),
  finalSummary: z.string().describe("A concluding summary explaining the findings in a clear, human-readable paragraph."),
});
export type ValidateSnpOutput = z.infer<typeof ValidateSnpOutputSchema>;


export async function validateSnp(input: ValidateSnpInput): Promise<ValidateSnpOutput> {
  return validateSnpFlow(input);
}


const prompt = ai.definePrompt({
  name: 'validateSnpPrompt',
  input: { schema: ValidateSnpInputSchema },
  output: { schema: ValidateSnpOutputSchema },
  tools: [lookupSnpDataTool],
  prompt: `You are an expert bioinformatician AI assistant. Your task is to validate a user's provided SNP data against authoritative databases.

**User's Provided Data:**
- SNP ID: {{snpId}}
- Consequence: {{consequence}}
- Gene: {{gene}}
- Amino Acid Change: {{aminoAcidChange}}
- Codon Change: {{codonChange}}
- Transcript: {{transcript}}
- Clinical Significance: {{clinicalSignificance}}

**Instructions:**
1.  **Use the Tool:** You MUST use the \`lookupSnpData\` tool with the user's provided \`snpId\` to fetch the ground truth data from the public databases.
2.  **Handle Multiple Annotations:** The tool may return multiple annotations (transcripts) for a single SNP. You must intelligently find the BEST match. The best match is the one where the most fields (gene, transcript, consequence) align with the user's input. If no transcript is provided by the user, use the most severe consequence reported by the database.
3.  **Field-by-Field Validation:** For EACH field, compare the user's input with the database value you found.
    - If they match, set \`isValid\` to true and write an explanation like "Matches database value."
    - If they do NOT match, set \`isValid\` to false, provide the correct \`databaseValue\`, and explain the discrepancy (e.g., "Database indicates consequence is 'missense_variant', not 'synonymous_variant'.").
    - If a user provides a value but the database has none, mark it as invalid and explain.
    - If a user does not provide a value, check if the database has one. If so, mark it as a mismatch, provide the database value, and explain that the field was missing. If both are empty, mark it as valid.
4.  **Overall Assessment:** Based on your field-by-field analysis, provide an \`overallAssessment\`. It should be 'Correct' only if ALL fields are valid.
5.  **Final Summary:** Write a brief, clear summary of your findings.

If the \`lookupSnpData\` tool returns no data, your entire response should reflect this. Set the \`overallAssessment\` to 'Not Found' and explain that the SNP could not be found in the database.

Generate the entire response in the specified JSON format.`,
});

const validateSnpFlow = ai.defineFlow(
  {
    name: 'validateSnpFlow',
    inputSchema: ValidateSnpInputSchema,
    outputSchema: ValidateSnpOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output) {
      throw new Error("The AI model did not return a valid SNP validation response.");
    }
    return output;
  }
);
