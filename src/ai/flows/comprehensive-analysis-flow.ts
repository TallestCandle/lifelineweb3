
'use server';
/**
 * @fileOverview A comprehensive health analysis AI agent that reviews historical data.
 *
 * - performComprehensiveAnalysis - A function that handles the deep analysis process.
 * - ComprehensiveAnalysisInput - The input type for the function.
 * - ComprehensiveAnalysisOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const ComprehensiveAnalysisInputSchema = z.object({
  vitalsHistory: z.string().describe("A JSON string representing an array of historical vital signs readings."),
  testStripHistory: z.string().describe("A JSON string representing an array of historical urine test strip results."),
  previousAnalyses: z.string().describe("A JSON string representing an array of previous AI analysis results."),
}).describe("A collection of the user's historical health data for deep analysis.");

export type ComprehensiveAnalysisInput = z.infer<typeof ComprehensiveAnalysisInputSchema>;

const ComprehensiveAnalysisOutputSchema = z.object({
  keyObservations: z.array(z.string()).describe("A list of the most critical observations or patterns discovered from the historical data."),
  deepInsights: z.array(z.object({
    insight: z.string().describe("A specific, granular insight that a human might miss. For example, 'A slight but consistent increase in diastolic pressure every third week' or 'Correlation between high ketone levels and reported low energy'."),
    supportingData: z.string().describe("A brief mention of the data points that support this insight."),
  })).describe("A list of deep, granular insights uncovered from analyzing trends, correlations, and anomalies in the user's health data over time."),
  overallAssessment: z.string().describe("A detailed paragraph summarizing the user's overall health trajectory based on the provided history. This should synthesize all insights into a coherent narrative."),
  criticalityScore: z.number().int().min(1).max(100).describe("A numerical score from 1-100 representing the overall criticality, where 100 is most critical. This score is derived from a rubric based on the severity and number of concerning trends."),
  urgency: z.enum(['Mild', 'Moderate', 'Critical']).describe("The urgency level classification derived from the criticalityScore. 'Mild' for minor long-term concerns, 'Moderate' for trends that need attention, and 'Critical' for patterns indicating a serious underlying issue."),
});

export type ComprehensiveAnalysisOutput = z.infer<typeof ComprehensiveAnalysisOutputSchema>;

export async function performComprehensiveAnalysis(input: ComprehensiveAnalysisInput): Promise<ComprehensiveAnalysisOutput> {
  return comprehensiveAnalysisFlow(input);
}

const prompt = ai.definePrompt({
    name: 'comprehensiveAnalysisPrompt',
    input: { schema: ComprehensiveAnalysisInputSchema },
    output: { schema: ComprehensiveAnalysisOutputSchema },
    prompt: `You are a world-class diagnostic AI with the ability to analyze vast amounts of longitudinal health data to uncover hidden patterns, trends, and correlations that even experienced doctors might miss. Your task is to perform a deep, comprehensive analysis of the user's historical health data.

The user's historical data is provided in three JSON strings:
1. Vitals History: {{{vitalsHistory}}}
2. Test Strip History: {{{testStripHistory}}}
3. Previous AI Analyses: {{{previousAnalyses}}}

Your analysis MUST be deep and granular. Do not just summarize the data. Look for:
- **Trends over time:** Gradual increases or decreases in any metric (e.g., weight, blood pressure).
- **Correlations:** Connections between different data points (e.g., do high blood sugar readings correlate with high ketone levels in urine?).
- **Anomalies and Outliers:** Significant deviations from the user's baseline.
- **Cyclical Patterns:** Are there patterns that repeat weekly or monthly?

Based on your deep analysis, provide a response in the required JSON format with five fields:
1.  'keyObservations': A bulleted list of the most important findings. If the final 'urgency' is 'Moderate' or 'Critical', you MUST add an observation to this list that strongly recommends booking a consultation with a doctor.
2.  'deepInsights': A list of non-obvious, granular insights. Each insight should be an object with the insight itself and the data that supports it.
3.  'overallAssessment': A detailed paragraph summarizing the user's health trajectory and synthesizing your findings.
4.  'criticalityScore': First, you MUST calculate a numerical score from 1 to 100 based on the severity and number of issues found. Use the following rubric:
    - **1-40 (Mild):** No significant negative trends. Data is stable or shows improvement.
    - **41-70 (Moderate):** One or more clear negative trends or consistent anomalies that require monitoring (e.g., consistently borderline-high blood pressure).
    - **71-100 (Critical):** Multiple significant negative trends, strong correlations between concerning data points, or clear red-flag events (e.g., sharp drops in oxygen, very high blood sugar readings). The higher the score, the more urgent the situation.
5.  'urgency': Based *only* on the 'criticalityScore' you just calculated, classify the situation as 'Mild' (score 1-40), 'Moderate' (score 41-70), or 'Critical' (score 71-100).`,
});


const comprehensiveAnalysisFlow = ai.defineFlow(
  {
    name: 'comprehensiveAnalysisFlow',
    inputSchema: ComprehensiveAnalysisInputSchema,
    outputSchema: ComprehensiveAnalysisOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output) {
        throw new Error("The AI model did not return a valid comprehensive analysis.");
    }
    return output;
  }
);
