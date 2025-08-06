
import { notFound } from 'next/navigation';
import { format } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, limit, Timestamp } from 'firebase/firestore';

interface Post {
  id: string;
  title: string;
  slug: string;
  content: string;
  createdAt: Date;
  authorName: string;
  isPublished: boolean;
}

async function getPost(slug: string): Promise<Post | null> {
  const postsRef = collection(db, 'posts');
  const q = query(postsRef, where("slug", "==", slug), where("isPublished", "==", true), limit(1));
  const querySnapshot = await getDocs(q);

  if (querySnapshot.empty) {
    return null;
  }

  const doc = querySnapshot.docs[0];
  const data = doc.data();
  
  return {
    id: doc.id,
    title: data.title,
    slug: data.slug,
    content: data.content,
    createdAt: (data.createdAt as Timestamp).toDate(),
    authorName: data.authorName,
    isPublished: data.isPublished,
  };
}

export default async function BlogPostPage({ params }: { params: { slug: string } }) {
  const post = await getPost(params.slug);

  if (!post) {
    notFound();
  }

  return (
    <div className="bg-secondary/30 min-h-screen">
        <div className="container mx-auto py-8 px-4 max-w-4xl">
            <Button asChild variant="ghost" className="mb-8">
                <Link href="/blog"><ArrowLeft className="mr-2"/> Back to Blog</Link>
            </Button>
            <article>
                <header className="mb-8 text-center">
                    <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-primary">{post.title}</h1>
                    <p className="mt-4 text-lg text-muted-foreground">
                        By {post.authorName} on {format(post.createdAt, 'MMMM d, yyyy')}
                    </p>
                </header>
                <Card>
                    <CardContent className="p-6 md:p-8">
                         <div
                            className="prose dark:prose-invert max-w-none prose-lg"
                            dangerouslySetInnerHTML={{ __html: post.content }}
                         />
                    </CardContent>
                </Card>
            </article>
        </div>
    </div>
  );
}
