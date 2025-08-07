
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowRight, Newspaper, Stethoscope } from 'lucide-react';
import Image from 'next/image';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, getDocs, Timestamp } from 'firebase/firestore';

interface Post {
  id: string;
  title: string;
  slug: string;
  content: string;
  imageUrl?: string;
  createdAt: Date;
  authorName: string;
  isPublished: boolean;
}

async function getPosts(): Promise<Post[]> {
  const postsRef = collection(db, 'posts');
  const q = query(postsRef, where("isPublished", "==", true), orderBy("createdAt", "desc"));
  const querySnapshot = await getDocs(q);
  
  return querySnapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      title: data.title,
      slug: data.slug,
      content: data.content,
      imageUrl: data.imageUrl,
      createdAt: (data.createdAt as Timestamp).toDate(),
      authorName: data.authorName,
      isPublished: data.isPublished,
    };
  });
}

export default async function BlogListPage() {
  const posts = await getPosts();
  const featuredPost = posts[0];
  const otherPosts = posts.slice(1);

  return (
     <div className="bg-secondary/30 min-h-screen">
        <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-sm">
            <div className="container mx-auto flex h-20 items-center justify-between px-4">
                <Link href="/landing" className="flex items-center gap-2 text-primary">
                    <Stethoscope className="w-8 h-8" />
                    <h1 className="text-2xl font-bold">Lifeline AI</h1>
                </Link>
                <div className="flex items-center gap-2">
                    <Button variant="ghost" asChild><Link href="/auth">Log In</Link></Button>
                    <Button asChild><Link href="/auth">Get Started</Link></Button>
                </div>
            </div>
        </header>

        <div className="container mx-auto py-8 px-4">
            <header className="text-center mb-12">
                <h1 className="text-5xl font-extrabold tracking-tight text-primary">The Lifeline Blog</h1>
                <p className="mt-4 text-xl text-muted-foreground">Insights and updates on proactive health.</p>
            </header>

            {featuredPost && (
                 <Card className="mb-12 overflow-hidden bg-background">
                    <CardContent className="p-0 grid md:grid-cols-2">
                         <div className="p-8 flex flex-col justify-center">
                            <p className="text-sm text-primary font-semibold mb-2">Featured Post</p>
                            <CardTitle className="text-3xl font-bold mb-4">{featuredPost.title}</CardTitle>
                            <div
                                className="mb-6 line-clamp-3 text-muted-foreground prose dark:prose-invert max-w-none"
                                dangerouslySetInnerHTML={{ __html: featuredPost.content }}
                            />
                            <p className="text-sm text-muted-foreground mb-6">
                                By {featuredPost.authorName} on {format(featuredPost.createdAt, 'MMMM d, yyyy')}
                            </p>
                            <Button asChild className="self-start">
                                <Link href={`/blog/${featuredPost.slug}`}>Read More <ArrowRight className="ml-2"/></Link>
                            </Button>
                        </div>
                        <div className="bg-primary/10 min-h-64 md:min-h-full flex items-center justify-center p-4">
                            <Image 
                                src={featuredPost.imageUrl || "https://placehold.co/600x400.png"}
                                alt={featuredPost.title}
                                width={600}
                                height={400}
                                className="rounded-lg object-cover"
                                data-ai-hint="health technology"
                            />
                        </div>
                    </CardContent>
                </Card>
            )}

            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                {otherPosts.map(post => (
                    <Card key={post.id} className="flex flex-col bg-background">
                        <CardHeader>
                            <CardTitle>{post.title}</CardTitle>
                            <CardDescription>
                                {format(post.createdAt, 'MMMM d, yyyy')}
                            </CardDescription>
                        </CardHeader>
                         <CardContent className="flex-grow">
                             <div
                                className="text-muted-foreground line-clamp-4 prose dark:prose-invert max-w-none"
                                dangerouslySetInnerHTML={{ __html: post.content }}
                            />
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
                <div className="text-center py-20 bg-background/50 rounded-lg">
                    <Newspaper className="mx-auto h-12 w-12 text-muted-foreground" />
                    <h2 className="mt-4 text-2xl font-bold">No posts yet.</h2>
                    <p className="text-muted-foreground mt-2">Check back soon for health insights!</p>
                </div>
            )}
        </div>
    </div>
  );
}

    