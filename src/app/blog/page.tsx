
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, orderBy, Timestamp } from 'firebase/firestore';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AppShell } from '@/components/app-shell';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { ProfileProvider } from '@/context/profile-provider';
import { SettingsProvider } from '@/context/settings-provider';

interface Post {
  id: string;
  title: string;
  slug: string;
  content: string;
  createdAt: Timestamp;
  authorName: string;
}

async function getPosts() {
  const q = query(collection(db, 'posts'), where('isPublished', '==', true), orderBy('createdAt', 'desc'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Post));
}

export default async function BlogListPage() {
  const posts = await getPosts();
  const featuredPost = posts[0];
  const otherPosts = posts.slice(1);

  return (
    <SettingsProvider>
      <ProfileProvider>
        <AppShell>
            <div className="container mx-auto py-8 px-4">
                <header className="text-center mb-12">
                    <h1 className="text-5xl font-extrabold tracking-tight text-primary">The Lifeline Blog</h1>
                    <p className="mt-4 text-xl text-muted-foreground">Insights and updates on proactive health.</p>
                </header>

                {featuredPost && (
                     <Card className="mb-12 overflow-hidden bg-secondary/50">
                        <CardContent className="p-0 grid md:grid-cols-2">
                             <div className="p-8 flex flex-col justify-center">
                                <p className="text-sm text-primary font-semibold mb-2">Featured Post</p>
                                <CardTitle className="text-3xl font-bold mb-4">{featuredPost.title}</CardTitle>
                                <CardDescription className="mb-6 line-clamp-3">
                                    {featuredPost.content.substring(0, 200)}...
                                </CardDescription>
                                <p className="text-sm text-muted-foreground mb-6">
                                    By {featuredPost.authorName} on {format(featuredPost.createdAt.toDate(), 'MMMM d, yyyy')}
                                </p>
                                <Button asChild className="self-start">
                                    <Link href={`/blog/${featuredPost.slug}`}>Read More <ArrowRight className="ml-2"/></Link>
                                </Button>
                            </div>
                            <div className="bg-primary/10 min-h-64 md:min-h-full">
                                {/* Placeholder for an image */}
                            </div>
                        </CardContent>
                    </Card>
                )}

                <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                    {otherPosts.map(post => (
                        <Card key={post.id} className="flex flex-col">
                            <CardHeader>
                                <CardTitle>{post.title}</CardTitle>
                                <CardDescription>
                                    {format(post.createdAt.toDate(), 'MMMM d, yyyy')}
                                </CardDescription>
                            </CardHeader>
                             <CardContent className="flex-grow">
                                <p className="text-muted-foreground line-clamp-4">
                                     {post.content.substring(0, 150)}...
                                </p>
                            </CardContent>
                            <div className="p-6 pt-0">
                                <Button asChild variant="outline">
                                    <Link href={`/blog/${post.slug}`}>Read More</Link>
                                </Button>
                            </div>
                        </Card>
                    ))}
                </div>

                {posts.length === 0 && (
                    <div className="text-center py-20">
                        <h2 className="text-2xl font-bold">No posts yet.</h2>
                        <p className="text-muted-foreground mt-2">Check back soon for health insights!</p>
                    </div>
                )}
            </div>
        </AppShell>
      </ProfileProvider>
    </SettingsProvider>
  );
}
