
'use server';

import { z } from 'zod';

const ENSEMBL_API_URL = "https://rest.ensembl.org";

export interface SnpLookupResult {
    id: string;
    most_severe_consequence: string;
    gene?: string;
    clinical_significance?: string;
}

const rsidSchema = z.object({
  rsid: z.string().regex(/^rs\d+$/),
});

const positionSchema = z.object({
  chromosome: z.string(),
  position: z.string(),
  allele: z.string(),
});

// Fetches annotations for a single variant from Ensembl
async function fetchVariantConsequences(identifier: string, species: string = 'human'): Promise<any[]> {
    try {
        const response = await fetch(`${ENSEMBL_API_URL}/vep/${species}/id/${identifier}`, {
            headers: { 'Content-Type': 'application/json' },
            next: { revalidate: 3600 } // Cache for 1 hour
        });
        if (!response.ok) {
            // If not found, return empty array, else throw error
            if(response.status === 404 || response.status === 400) {
                console.warn(`Variant ${identifier} not found in Ensembl.`);
                return [];
            }
            throw new Error(`Ensembl API error: ${response.statusText}`);
        }
        return response.json();
    } catch (error) {
        console.error(`Error fetching data for ${identifier}:`, error);
        throw error;
    }
}

function parseVcf(content: string): string[] {
    return content
        .split('\n')
        .filter(line => !line.startsWith('#') && line.trim() !== '')
        .map(line => {
            const fields = line.split('\t');
            if (fields.length >= 3) {
                const [chrom, pos, rsid] = fields;
                if(rsid && rsid.startsWith('rs')) {
                    return rsid;
                }
            }
            return null;
        })
        .filter((id): id is string => id !== null);
}

export async function performSnpLookup(formData: FormData): Promise<SnpLookupResult[]> {
    const type = formData.get('type') as 'rsid' | 'position' | 'file';
    
    let identifiers: string[] = [];

    if (type === 'rsid') {
        const data = JSON.parse(formData.get('data') as string);
        const parsed = rsidSchema.safeParse(data);
        if (!parsed.success) throw new Error("Invalid rsID format.");
        identifiers.push(parsed.data.rsid);
    } else if (type === 'position') {
        const data = JSON.parse(formData.get('data') as string);
        const parsed = positionSchema.safeParse(data);
        if (!parsed.success) throw new Error("Invalid position format.");
        // Ensembl VEP doesn't support position-based lookup in the same way. We would need a different endpoint.
        // For simplicity, this is not implemented. A better approach would be to convert position to rsID first if possible.
        throw new Error("Lookup by chromosomal position is not supported in this version.");
    } else if (type === 'file') {
        const file = formData.get('file') as File;
        if (!file) throw new Error("No file provided.");
        
        const content = await file.text();
        identifiers = parseVcf(content);
        if (identifiers.length === 0) {
             throw new Error("No valid rsIDs found in the provided file. Please ensure it's a valid VCF with rsIDs in the 3rd column.");
        }
    } else {
        throw new Error("Invalid lookup type.");
    }
    
    // Batch requests to Ensembl if we have many identifiers from a file
    const batchSize = 200; // Ensembl VEP POST limit
    const results: SnpLookupResult[] = [];

    for (let i = 0; i < identifiers.length; i += batchSize) {
        const batch = identifiers.slice(i, i + batchSize);
        // Using GET for single lookups, but VEP POST is better for batch
        // For simplicity, we'll do them one by one here. In production, a POST to /vep/human/id would be better.
        for (const id of batch) {
            const data = await fetchVariantConsequences(id);
            if (data && data.length > 0) {
                const variantData = data[0];
                const transcriptConsequences = variantData.transcript_consequences || [];
                const mostSevere = transcriptConsequences.find((c: any) => c.impact === 'HIGH' || c.impact === 'MODERATE') || transcriptConsequences[0];
                
                results.push({
                    id: variantData.id,
                    most_severe_consequence: variantData.most_severe_consequence,
                    gene: mostSevere?.gene_symbol,
                    clinical_significance: variantData.clinical_significance?.[0],
                });
            }
        }
    }

    return results;
}
