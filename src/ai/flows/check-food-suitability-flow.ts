
'use server';
/**
 * @fileOverview An AI agent that checks if a specific food is suitable for a given health condition.
 *
 * - checkFoodSuitability - Checks a food item against a health condition.
 * - CheckFoodSuitabilityInput - The input type for the function.
 * - CheckFoodSuitabilityOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const CheckFoodSuitabilityInputSchema = z.object({
  foodQuery: z.string().describe("The user's question about a specific food item, e.g., 'onions', 'Can I eat avocados?', 'Is watermelon good for me?'"),
  healthCondition: z.string().describe("The user's specific health condition, e.g., 'Chronic Kidney Disease (CKD) Stage 4', 'Type 2 Diabetes'."),
});
export type CheckFoodSuitabilityInput = z.infer<typeof CheckFoodSuitabilityInputSchema>;


const CheckFoodSuitabilityOutputSchema = z.object({
    isSuitable: z.enum(['Yes', 'No', 'In Moderation']).describe("A direct answer to whether the food is suitable."),
    explanation: z.string().describe("A brief, clear explanation for the answer, including any important considerations like portion size or preparation method."),
    contextualTips: z.array(z.string()).describe("A list of 1-2 very short, related tips or warnings."),
});
export type CheckFoodSuitabilityOutput = z.infer<typeof CheckFoodSuitabilityOutputSchema>;


export async function checkFoodSuitability(input: CheckFoodSuitabilityInput): Promise<CheckFoodSuitabilityOutput> {
  return checkFoodSuitabilityFlow(input);
}

const prompt = ai.definePrompt({
    name: 'checkFoodSuitabilityPrompt',
    input: { schema: CheckFoodSuitabilityInputSchema },
    output: { schema: CheckFoodSuitabilityOutputSchema },
    prompt: `You are an expert AI Dietician specializing in dietary restrictions for specific health conditions, particularly Chronic Kidney Disease (CKD), diabetes, and hypertension. A user has a direct question about a food item.

**User's Health Condition:**
"{{{healthCondition}}}"

**User's Food Query:**
"{{{foodQuery}}}"

**Your Task:**
1.  **Direct Answer:** Determine if the food item in the 'foodQuery' is suitable for the 'healthCondition'. Set 'isSuitable' to 'Yes', 'No', or 'In Moderation'.
    -   'Yes': The food is generally safe and beneficial.
    -   'In Moderation': The food can be eaten but with caution, usually regarding portion size or frequency.
    -   'No': The food should be avoided as it poses a risk.
2.  **Clear Explanation:** Provide a concise 'explanation'. If it's 'In Moderation' or 'No', explain exactly why (e.g., "Onions are high in potassium, which should be limited in late-stage CKD."). If it's 'Yes', explain the benefits (e.g., "Fish is a great source of lean protein.").
3.  **Provide Tips:** Offer 1-2 very short, actionable 'contextualTips'. For example, "If you do eat it, leach it first to reduce potassium," or "Opt for fresh fish over canned to control sodium."

Your entire response MUST be in the specified JSON format. Be direct, clear, and safe.`,
});


const checkFoodSuitabilityFlow = ai.defineFlow(
  {
    name: 'checkFoodSuitabilityFlow',
    inputSchema: CheckFoodSuitabilityInputSchema,
    outputSchema: CheckFoodSuitabilityOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output) {
        throw new Error("The AI model did not return a valid food suitability analysis.");
    }
    return output;
  }
);
