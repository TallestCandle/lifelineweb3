
"use client";

import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { PlusCircle, Edit, Trash2, Loader2, Eye, EyeOff } from 'lucide-react';
import { format } from 'date-fns';
import { Switch } from '../ui/switch';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Link from 'next/link';

const postSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters'),
  content: z.string().min(50, 'Content must be at least 50 characters'),
  isPublished: z.boolean().default(false),
});

type PostFormValues = z.infer<typeof postSchema>;

interface Post {
  id: string;
  title: string;
  slug: string;
  content: string;
  isPublished: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  authorName: string;
}

export function BlogManager() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<Post | null>(null);

  const form = useForm<PostFormValues>({
    resolver: zodResolver(postSchema),
    defaultValues: {
      title: '',
      content: '',
      isPublished: false,
    },
  });

  useEffect(() => {
    const fetchPosts = async () => {
      setIsLoading(true);
      const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      setPosts(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Post)));
      setIsLoading(false);
    };
    fetchPosts();
  }, []);

  const openDialog = (post: Post | null = null) => {
    setEditingPost(post);
    if (post) {
      form.reset({
        title: post.title,
        content: post.content,
        isPublished: post.isPublished,
      });
    } else {
      form.reset({ title: '', content: '', isPublished: false });
    }
    setIsDialogOpen(true);
  };

  const createSlug = (title: string) => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  };

  const onSubmit = async (data: PostFormValues) => {
    if (!user) {
      toast({ variant: 'destructive', title: 'Authentication Error' });
      return;
    }

    const postData = {
      ...data,
      slug: createSlug(data.title),
      authorName: user.displayName || 'Admin',
      authorId: user.uid,
      updatedAt: serverTimestamp(),
    };

    try {
      if (editingPost) {
        const postRef = doc(db, 'posts', editingPost.id);
        await updateDoc(postRef, postData);
        toast({ title: 'Post Updated' });
        setPosts(posts.map(p => p.id === editingPost.id ? { ...p, ...data, slug: postData.slug, updatedAt: Timestamp.now() } : p));
      } else {
        const docRef = await addDoc(collection(db, 'posts'), {
          ...postData,
          createdAt: serverTimestamp(),
        });
        const newPost = { ...postData, id: docRef.id, createdAt: Timestamp.now() } as Post;
        setPosts([newPost, ...posts]);
        toast({ title: 'Post Created' });
      }
      setIsDialogOpen(false);
    } catch (error) {
      console.error('Error saving post:', error);
      toast({ variant: 'destructive', title: 'Save Failed' });
    }
  };

  const deletePost = async (postId: string) => {
    try {
      await deleteDoc(doc(db, 'posts', postId));
      setPosts(posts.filter(p => p.id !== postId));
      toast({ title: 'Post Deleted' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Delete Failed' });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Blog Management</CardTitle>
            <CardDescription>Create, edit, and manage your blog posts.</CardDescription>
          </div>
          <Button onClick={() => openDialog()}>
            <PlusCircle className="mr-2" /> New Post
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          ) : posts.length > 0 ? (
            <div className="space-y-4">
              {posts.map(post => (
                <div key={post.id} className="flex justify-between items-center p-4 border rounded-lg">
                  <div>
                    <h3 className="font-bold text-lg">{post.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      By {post.authorName} on {format(post.createdAt.toDate(), 'MMM d, yyyy')}
                    </p>
                     <Link href={`/blog/${post.slug}`} target="_blank" className="text-xs text-primary hover:underline">
                        View Post
                    </Link>
                  </div>
                  <div className="flex items-center gap-4">
                    {post.isPublished ? (
                      <span className="flex items-center gap-1 text-sm text-green-500"><Eye className="h-4 w-4"/> Published</span>
                    ) : (
                      <span className="flex items-center gap-1 text-sm text-muted-foreground"><EyeOff className="h-4 w-4"/> Draft</span>
                    )}
                    <Button variant="outline" size="icon" onClick={() => openDialog(post)}><Edit className="h-4 w-4"/></Button>
                    <Button variant="destructive" size="icon" onClick={() => deletePost(post.id)}><Trash2 className="h-4 w-4"/></Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">No blog posts yet. Create one to get started!</p>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{editingPost ? 'Edit Post' : 'Create New Post'}</DialogTitle>
            <DialogDescription>
              Write your content using Markdown. A live preview is shown below.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 flex-grow flex flex-col overflow-hidden">
                <div className="grid md:grid-cols-2 gap-4 flex-grow overflow-hidden">
                    <div className="space-y-4 flex flex-col">
                        <FormField control={form.control} name="title" render={({ field }) => (<FormItem><FormLabel>Title</FormLabel><FormControl><Input placeholder="Your amazing post title" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="content" render={({ field }) => (
                            <FormItem className="flex-grow flex flex-col">
                                <FormLabel>Content (Markdown)</FormLabel>
                                <FormControl><Textarea placeholder="Start writing your masterpiece..." {...field} className="flex-grow resize-none font-mono" /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                    </div>
                    <div className="space-y-2 flex flex-col">
                        <Label>Live Preview</Label>
                        <Card className="flex-grow overflow-y-auto">
                            <CardContent className="prose dark:prose-invert max-w-none p-4">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {form.watch('content')}
                                </ReactMarkdown>
                            </CardContent>
                        </Card>
                    </div>
                </div>
                <DialogFooter className="pt-4 border-t !justify-between">
                     <FormField control={form.control} name="isPublished" render={({ field }) => (
                        <FormItem className="flex items-center gap-2">
                           <FormControl>
                                <Switch checked={field.value} onCheckedChange={field.onChange} id="isPublished"/>
                           </FormControl>
                           <Label htmlFor="isPublished" className="font-normal">Publish Post</Label>
                        </FormItem>
                     )} />
                    <div>
                        <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                        <Button type="submit" disabled={form.formState.isSubmitting}>
                            {form.formState.isSubmitting && <Loader2 className="animate-spin mr-2"/>}
                            Save Post
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
