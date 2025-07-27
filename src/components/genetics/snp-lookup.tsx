
"use client";

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dna, Upload, Search, FileText, Loader2, ChevronsUpDown, X } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from '@/hooks/use-toast';
import { type SnpLookupResult, performSnpLookup } from '@/app/actions/snp-lookup-action';
import { ScrollArea } from '../ui/scroll-area';

const rsidSchema = z.object({
  rsid: z.string().regex(/^rs\d+$/, { message: "Invalid rsID format (e.g., rs12345)." })
});

const positionSchema = z.object({
  chromosome: z.string().min(1, "Required"),
  position: z.string().min(1, "Required"),
  allele: z.string().min(1, "Required"),
});

const fileSchema = z.object({
  file: z.instanceof(File).refine(file => file.size < 5 * 1024 * 1024, 'File size must be under 5MB.')
});


export function SnpLookup() {
  const [results, setResults] = useState<SnpLookupResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
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

  const handleLookup = async (type: 'rsid' | 'position', data: any) => {
    setIsLoading(true);
    setResults([]);
    try {
      const formData = new FormData();
      formData.append('type', type);
      formData.append('data', JSON.stringify(data));
      
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

  const handleFileLookup = async (data: z.infer<typeof fileSchema>) => {
    setIsLoading(true);
    setResults([]);
    try {
      const formData = new FormData();
      formData.append('type', 'file');
      formData.append('file', data.file);
      
      const lookupResults = await performSnpLookup(formData);
      setResults(lookupResults);
      if (lookupResults.length === 0) {
        toast({ title: "No Results Found", description: "No variants in the file could be annotated." });
      } else {
         toast({ title: "Lookup Complete", description: `Found annotations for ${lookupResults.length} variants.` });
      }
    } catch (error: any) {
      console.error(error);
      toast({ variant: 'destructive', title: 'File Processing Failed', description: error.message || 'Please check the file format and try again.' });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Dna/> SNP Annotation Lookup</CardTitle>
          <CardDescription>
            Enter a single SNP by rsID or chromosomal position, or upload a file (VCF format) to retrieve functional annotations from Ensembl.
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
                <form onSubmit={rsidForm.handleSubmit(data => handleLookup('rsid', data))} className="flex items-end gap-4">
                  <FormField control={rsidForm.control} name="rsid" render={({ field }) => (
                    <FormItem className="flex-grow"><FormLabel>dbSNP ID</FormLabel><FormControl><Input placeholder="e.g., rs1801133" {...field} /></FormControl><FormMessage /></FormItem>
                  )}/>
                  <Button type="submit" disabled={isLoading}><Search className="mr-2 h-4 w-4"/>Lookup</Button>
                </form>
              </Form>
            </TabsContent>

            <TabsContent value="position" className="mt-4">
              <Form {...positionForm}>
                <form onSubmit={positionForm.handleSubmit(data => handleLookup('position', data))} className="flex items-end gap-2">
                  <FormField control={positionForm.control} name="chromosome" render={({ field }) => (
                    <FormItem><FormLabel>Chr.</FormLabel><FormControl><Input placeholder="1" {...field} /></FormControl><FormMessage /></FormItem>
                  )}/>
                  <FormField control={positionForm.control} name="position" render={({ field }) => (
                    <FormItem className="flex-grow"><FormLabel>Position</FormLabel><FormControl><Input placeholder="67769422" type="number" {...field} /></FormControl><FormMessage /></FormItem>
                  )}/>
                  <FormField control={positionForm.control} name="allele" render={({ field }) => (
                    <FormItem><FormLabel>Allele</FormLabel><FormControl><Input placeholder="A" {...field} /></FormControl><FormMessage /></FormItem>
                  )}/>
                  <Button type="submit" disabled={isLoading}><Search className="mr-2 h-4 w-4"/>Lookup</Button>
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
            {isLoading ? (
              <div className="flex justify-center items-center py-16">
                <Loader2 className="w-12 h-12 animate-spin text-primary"/>
              </div>
            ) : (
                <ScrollArea className="h-[400px] border rounded-md">
                    <Table>
                        <TableHeader className="sticky top-0 bg-secondary">
                        <TableRow>
                            <TableHead>SNP ID</TableHead>
                            <TableHead>Consequence</TableHead>
                            <TableHead>Gene</TableHead>
                            <TableHead>Clinical Significance</TableHead>
                        </TableRow>
                        </TableHeader>
                        <TableBody>
                        {results.map((res, index) => (
                            <TableRow key={`${res.id}-${index}`}>
                            <TableCell className="font-mono">
                                <a href={`https://www.ensembl.org/Homo_sapiens/Variation/Summary?v=${res.id}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                                    {res.id}
                                </a>
                            </TableCell>
                            <TableCell>{res.most_severe_consequence}</TableCell>
                            <TableCell>{res.gene || 'N/A'}</TableCell>
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
