
"use client";

import React, { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dna, Upload, Search, FileText, Loader2, StopCircle, HelpCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { type SnpLookupResult, performSnpLookup } from '@/app/actions/snp-lookup-action';
import { ScrollArea } from '../ui/scroll-area';
import { Progress } from '../ui/progress';

const rsidSchema = z.object({
  rsid: z.string().regex(/^rs\d+$/, { message: "Invalid rsID format (e.g., rs12345)." })
});

const positionSchema = z.object({
  chromosome: z.string().min(1, "Required"),
  position: z.string().min(1, "Required"),
  allele: z.string().min(1, "Required"),
});

const fileSchema = z.object({
  file: z.instanceof(File).refine(file => file.size < 100 * 1024 * 1024, 'File size must be under 100MB.')
});


export function SnpLookup() {
  const [results, setResults] = useState<SnpLookupResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [totalVariants, setTotalVariants] = useState(0);
  const isProcessingFile = useRef(false);
  const { toast } = useToast();

  const rsidForm = useForm<z.infer<typeof rsidSchema>>({ 
    resolver: zodResolver(rsidSchema),
    defaultValues: { rsid: '' } 
  });
  const positionForm = useForm<z.infer<typeof positionSchema>>({ 
    resolver: zodResolver(positionSchema),
    defaultValues: { chromosome: '', position: '', allele: '' }
  });
  const fileForm = useForm<z.infer<typeof fileSchema>>({ 
    resolver: zodResolver(fileSchema),
    defaultValues: { file: undefined }
  });

  const handleSingleLookup = async (type: 'rsid' | 'position', data: any) => {
    setIsLoading(true);
    setResults([]);
    try {
      const formData = new FormData();
      formData.append('type', type);
      formData.append('data', JSON.stringify([data])); // Send as an array
      
      const lookupResults = await performSnpLookup(formData);
      setResults(lookupResults);

      if (lookupResults.length === 0) {
        toast({ title: "No Results Found", description: "The provided SNP could not be found or has no significant annotations." });
      }
    } catch (error: any) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Lookup Failed', description: error.message || 'An unexpected error occurred.' });
    } finally {
      setIsLoading(false);
    }
  };

  const parseRsidsFromFile = (fileContent: string): string[] => {
      const lines = fileContent.split('\n');
      const rsids = new Set<string>(); // Use a set to avoid duplicate lookups
      for (const line of lines) {
          if (line.startsWith('#')) continue;
          const fields = line.split(/\s+/); // Split by any whitespace
          // The rsID is usually in the 3rd column (index 2) of a VCF file.
          if (fields.length > 2 && fields[2].startsWith('rs')) {
              rsids.add(fields[2]);
          } else {
              // Also check other fields for rsIDs just in case
              for(const field of fields) {
                  if (field.startsWith('rs')) {
                      rsids.add(field);
                      break; // Assume one rsID per line
                  }
              }
          }
      }
      return Array.from(rsids);
  };

  const handleFileLookup = async (data: z.infer<typeof fileSchema>) => {
    isProcessingFile.current = true;
    setIsLoading(true);
    setResults([]);
    setProgress(0);
    setTotalVariants(0);

    const reader = new FileReader();
    reader.onload = async (e) => {
        const content = e.target?.result as string;
        const allRsids = parseRsidsFromFile(content);
        
        if (allRsids.length === 0) {
            toast({ variant: 'destructive', title: 'No rsIDs Found', description: "Could not find any valid rsIDs in the uploaded file." });
            setIsLoading(false);
            isProcessingFile.current = false;
            return;
        }

        setTotalVariants(allRsids.length);
        
        const BATCH_SIZE = 10;
        for (let i = 0; i < allRsids.length; i += BATCH_SIZE) {
            if (!isProcessingFile.current) {
                toast({ title: "Processing Cancelled", description: "File processing was stopped." });
                break;
            }
            const batch = allRsids.slice(i, i + BATCH_SIZE);
            try {
                const formData = new FormData();
                formData.append('type', 'rsid'); // Use rsid type for batched lookup
                formData.append('data', JSON.stringify(batch.map(rsid => ({ rsid }))));
                
                const batchResults = await performSnpLookup(formData);
                setResults(prev => [...prev, ...batchResults]);
            } catch (error: any) {
                console.error(`Error processing batch ${i/BATCH_SIZE + 1}:`, error);
                toast({ variant: 'destructive', title: `Batch Failed`, description: `Could not process variants starting with ${batch[0]}.` });
            }
            setProgress(i + BATCH_SIZE > allRsids.length ? 100 : Math.round(((i + BATCH_SIZE) / allRsids.length) * 100));
        }

        toast({ title: "File Processing Complete", description: `Annotated ${results.length} out of ${allRsids.length} unique variants.` });
        setIsLoading(false);
        isProcessingFile.current = false;
    };
    reader.onerror = () => {
        toast({ variant: 'destructive', title: 'File Read Error', description: "Could not read the uploaded file." });
        setIsLoading(false);
        isProcessingFile.current = false;
    }
    reader.readAsText(data.file);
  }

  const stopFileProcessing = () => {
    isProcessingFile.current = false;
  }

  const TooltipHeader = ({ children, tooltipText }: { children: React.ReactNode, tooltipText: string }) => (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1 cursor-help">
            {children}
            <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Dna/> SNP Annotation Lookup</CardTitle>
          <CardDescription>
            Enter a single SNP by rsID or chromosomal position, or upload a VCF file to retrieve functional annotations from Ensembl.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="rsid">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="rsid">by rsID</TabsTrigger>
              <TabsTrigger value="position">by Position</TabsTrigger>
              <TabsTrigger value="file">by File</TabsTrigger>
            </TabsList>
            
            <TabsContent value="rsid" className="mt-4">
              <Form {...rsidForm}>
                <form onSubmit={rsidForm.handleSubmit(data => handleSingleLookup('rsid', data))} className="flex items-end gap-4">
                  <FormField control={rsidForm.control} name="rsid" render={({ field }) => (
                    <FormItem className="flex-grow"><FormLabel>dbSNP ID</FormLabel><FormControl><Input placeholder="e.g., rs1801133" {...field} /></FormControl><FormMessage /></FormItem>
                  )}/>
                  <Button type="submit" disabled={isLoading}><Search className="mr-2 h-4 w-4"/>Lookup</Button>
                </form>
              </Form>
            </TabsContent>

            <TabsContent value="position" className="mt-4">
              <Form {...positionForm}>
                <form onSubmit={positionForm.handleSubmit(data => handleSingleLookup('position', data))} className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
                    <FormField control={positionForm.control} name="chromosome" render={({ field }) => (
                        <FormItem><FormLabel>Chromosome</FormLabel><FormControl><Input placeholder="e.g., 1" {...field} /></FormControl><FormMessage /></FormItem>
                    )}/>
                    <FormField control={positionForm.control} name="position" render={({ field }) => (
                        <FormItem><FormLabel>Position</FormLabel><FormControl><Input placeholder="e.g., 1014143" type="number" {...field} /></FormControl><FormMessage /></FormItem>
                    )}/>
                    <FormField control={positionForm.control} name="allele" render={({ field }) => (
                        <FormItem><FormLabel>Allele</FormLabel><FormControl><Input placeholder="e.g., T" {...field} /></FormControl><FormMessage /></FormItem>
                    )}/>
                    <Button type="submit" disabled={isLoading} className="w-full sm:w-auto"><Search className="mr-2 h-4 w-4"/>Lookup</Button>
                </form>
              </Form>
            </TabsContent>

            <TabsContent value="file" className="mt-4">
              <Form {...fileForm}>
                <form onSubmit={fileForm.handleSubmit(handleFileLookup)} className="flex items-end gap-4">
                  <FormField control={fileForm.control} name="file" render={({ field: { onChange, value, ...rest } }) => (
                    <FormItem className="flex-grow">
                      <FormLabel>VCF or TXT file (.vcf, .txt)</FormLabel>
                      <FormControl>
                        <Input 
                          type="file"
                          accept=".vcf,.txt"
                          onChange={(e) => onChange(e.target.files?.[0])}
                          {...rest}
                          className="file:text-primary"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}/>
                  <Button type="submit" disabled={isLoading}><Upload className="mr-2 h-4 w-4"/>Upload & Annotate</Button>
                </form>
              </Form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      
      {(isLoading || results.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>Annotation Results</CardTitle>
            {results.length > 0 && <CardDescription>Found {results.length} annotation(s). Clinical significance from ClinVar if available.</CardDescription>}
          </CardHeader>
          <CardContent>
            {isLoading && isProcessingFile.current && (
                <div className="flex items-center gap-4">
                    <div className="w-full">
                        <div className="flex justify-between mb-1">
                            <p className="text-sm font-bold">Processing file...</p>
                            <p className="text-sm">{progress}%</p>
                        </div>
                        <Progress value={progress} />
                    </div>
                    <Button variant="destructive" size="icon" onClick={stopFileProcessing}><StopCircle /></Button>
                </div>
            )}
            {isLoading && !isProcessingFile.current ? (
              <div className="flex justify-center items-center py-16">
                <Loader2 className="w-12 h-12 animate-spin text-primary"/>
              </div>
            ) : (
                <ScrollArea className="h-[400px] border rounded-md">
                    <Table>
                        <TableHeader className="sticky top-0 bg-secondary z-10">
                        <TableRow>
                            <TableHead><TooltipHeader tooltipText="The identifier for the SNP, usually an rsID.">SNP ID</TooltipHeader></TableHead>
                            <TableHead><TooltipHeader tooltipText="The most significant functional consequence of the SNP (e.g., missense, synonymous).">Consequence</TooltipHeader></TableHead>
                            <TableHead><TooltipHeader tooltipText="The gene in which the SNP is located.">Gene</TooltipHeader></TableHead>
                            <TableHead><TooltipHeader tooltipText="The change in the amino acid sequence (Original AA, Position, New AA).">Amino Acid Change</TooltipHeader></TableHead>
                            <TableHead><TooltipHeader tooltipText="The change in the DNA codon (e.g., from ATG to ACG).">Codon Change</TooltipHeader></TableHead>
                            <TableHead><TooltipHeader tooltipText="The Ensembl transcript this annotation applies to.">Transcript</TooltipHeader></TableHead>
                            <TableHead><TooltipHeader tooltipText="Clinical significance as reported by ClinVar.">Clinical Significance</TooltipHeader></TableHead>
                        </TableRow>
                        </TableHeader>
                        <TableBody>
                        {results.map((res, index) => (
                            <TableRow key={`${res.id}-${index}`}>
                            <TableCell className="font-mono">
                                <a href={`https://www.ncbi.nlm.nih.gov/snp/${res.id}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                                    {res.id}
                                </a>
                            </TableCell>
                            <TableCell>{res.most_severe_consequence}</TableCell>
                            <TableCell>{res.gene || 'N/A'}</TableCell>
                            <TableCell>{res.aminoAcidChange || 'N/A'}</TableCell>
                            <TableCell>{res.codonChange || 'N/A'}</TableCell>
                            <TableCell className="font-mono text-xs">{res.transcriptId || 'N/A'}</TableCell>
                            <TableCell className="capitalize text-sm">
                                {res.clinical_significance ? (
                                    <span className={`font-bold ${
                                        res.clinical_significance.includes('pathogenic') ? 'text-destructive' :
                                        res.clinical_significance.includes('benign') ? 'text-green-500' : ''
                                    }`}>
                                        {res.clinical_significance.replace(/_/g, ' ')}
                                    </span>
                                ) : 'N/A'}
                            </TableCell>
                            </TableRow>
                        ))}
                        </TableBody>
                    </Table>
                </ScrollArea>
            )}
          </CardContent>
        </Card>
      )}

    </div>
  );
}

    