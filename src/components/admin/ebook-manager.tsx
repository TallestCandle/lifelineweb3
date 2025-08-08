
"use client";

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { db } from '@/lib/firebase';
import { collection, addDoc, getDocs, query, orderBy, doc, updateDoc, deleteDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { useAuth } from '@/context/auth-provider';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PlusCircle, Edit, Trash2, Loader2, Eye, EyeOff } from 'lucide-react';
import { Switch } from '../ui/switch';
import Image from 'next/image';
import { Label } from '../ui/label';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../ui/alert-dialog';

const ebookSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  price: z.coerce.number().min(0, 'Price cannot be negative'),
  coverImageUrl: z.string().url({ message: "Please enter a valid cover image URL." }),
  ebookFileUrl: z.string().url({ message: "Please enter a valid ebook file URL (e.g., PDF link)." }),
  isPublished: z.boolean().default(false),
});

type EbookFormValues = z.infer<typeof ebookSchema>;

interface Ebook {
  id: string;
  title: string;
  description: string;
  price: number;
  coverImageUrl: string;
  ebookFileUrl: string;
  isPublished: boolean;
  createdAt: Timestamp;
}

export function EbookManager() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [ebooks, setEbooks] = useState<Ebook[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEbook, setEditingEbook] = useState<Ebook | null>(null);

  const form = useForm<EbookFormValues>({
    resolver: zodResolver(ebookSchema),
    defaultValues: {
      title: '',
      description: '',
      price: 0,
      coverImageUrl: '',
      ebookFileUrl: '',
      isPublished: false,
    },
  });

  useEffect(() => {
    const fetchEbooks = async () => {
      setIsLoading(true);
      const q = query(collection(db, 'ebooks'), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      setEbooks(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Ebook)));
      setIsLoading(false);
    };
    fetchEbooks();
  }, []);

  const openDialog = (ebook: Ebook | null = null) => {
    setEditingEbook(ebook);
    if (ebook) {
      form.reset({
        title: ebook.title,
        description: ebook.description,
        price: ebook.price,
        coverImageUrl: ebook.coverImageUrl,
        ebookFileUrl: ebook.ebookFileUrl,
        isPublished: ebook.isPublished,
      });
    } else {
      form.reset({ title: '', description: '', price: 0, coverImageUrl: '', ebookFileUrl: '', isPublished: false });
    }
    setIsDialogOpen(true);
  };

  const onSubmit = async (data: EbookFormValues) => {
    if (!user) {
      toast({ variant: 'destructive', title: 'Authentication Error' });
      return;
    }

    try {
      if (editingEbook) {
        const ebookRef = doc(db, 'ebooks', editingEbook.id);
        await updateDoc(ebookRef, data);
        toast({ title: 'Ebook Updated' });
        setEbooks(ebooks.map(p => p.id === editingEbook.id ? { ...p, ...data } : p));
      } else {
        const docRef = await addDoc(collection(db, 'ebooks'), {
          ...data,
          createdAt: serverTimestamp(),
        });
        const newEbook = { ...data, id: docRef.id, createdAt: Timestamp.now() } as Ebook;
        setEbooks([newEbook, ...ebooks]);
        toast({ title: 'Ebook Created' });
      }
      setIsDialogOpen(false);
    } catch (error) {
      console.error('Error saving ebook:', error);
      toast({ variant: 'destructive', title: 'Save Failed' });
    }
  };

  const deleteEbook = async (ebookId: string) => {
    try {
      await deleteDoc(doc(db, 'ebooks', ebookId));
      setEbooks(ebooks.filter(p => p.id !== ebookId));
      toast({ title: 'Ebook Deleted' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Delete Failed' });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Ebook Management</CardTitle>
            <CardDescription>Add, edit, and manage your ebooks for the store.</CardDescription>
          </div>
          <Button onClick={() => openDialog()}>
            <PlusCircle className="mr-2" /> New Ebook
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin" /></div>
          ) : ebooks.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {ebooks.map(ebook => (
                <Card key={ebook.id} className="flex flex-col">
                  <div className="relative aspect-[3/4]">
                    <Image src={ebook.coverImageUrl} alt={ebook.title} layout="fill" objectFit="cover" className="rounded-t-lg" />
                  </div>
                  <CardHeader>
                    <CardTitle className="text-lg line-clamp-2">{ebook.title}</CardTitle>
                    <CardDescription>₦{ebook.price.toLocaleString()}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex-grow">
                    <p className="text-sm text-muted-foreground line-clamp-3">{ebook.description}</p>
                  </CardContent>
                  <CardFooter className="flex justify-between items-center">
                     {ebook.isPublished ? (
                      <span className="flex items-center gap-1 text-xs text-green-500"><Eye className="h-4 w-4"/> Published</span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground"><EyeOff className="h-4 w-4"/> Draft</span>
                    )}
                    <div className="flex gap-1">
                        <Button variant="outline" size="icon" onClick={() => openDialog(ebook)}><Edit className="h-4 w-4"/></Button>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive" size="icon"><Trash2 className="h-4 w-4"/></Button>
                            </AlertDialogTrigger>
                             <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                    <AlertDialogDescription>This will permanently delete the ebook "{ebook.title}". This action cannot be undone.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => deleteEbook(ebook.id)}>Delete</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                  </CardFooter>
                </Card>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">No ebooks yet. Create one to get started!</p>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingEbook ? 'Edit Ebook' : 'Create New Ebook'}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
              <FormField control={form.control} name="title" render={({ field }) => (<FormItem><FormLabel>Title</FormLabel><FormControl><Input placeholder="Ebook title" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="description" render={({ field }) => (<FormItem><FormLabel>Description</FormLabel><FormControl><Textarea placeholder="A brief summary of the ebook" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="price" render={({ field }) => (<FormItem><FormLabel>Price (NGN)</FormLabel><FormControl><Input type="number" placeholder="e.g., 5000" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="coverImageUrl" render={({ field }) => (<FormItem><FormLabel>Cover Image URL</FormLabel><FormControl><Input placeholder="https://example.com/cover.png" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="ebookFileUrl" render={({ field }) => (<FormItem><FormLabel>Ebook File URL</FormLabel><FormControl><Input placeholder="https://example.com/ebook.pdf" {...field} /></FormControl><FormMessage /></FormItem>)} />
              
              <DialogFooter className="!justify-between border-t pt-4">
                 <FormField control={form.control} name="isPublished" render={({ field }) => (
                    <FormItem className="flex items-center gap-2">
                       <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} id="isPublished"/></FormControl>
                       <Label htmlFor="isPublished" className="font-normal">Publish Ebook</Label>
                    </FormItem>
                 )} />
                <div>
                    <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={form.formState.isSubmitting}>
                        {form.formState.isSubmitting && <Loader2 className="animate-spin mr-2"/>}
                        Save Ebook
                    </Button>
                </div>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
