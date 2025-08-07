
"use client";

import { useState, useEffect } from 'react';
import { notFound } from 'next/navigation';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Tag, Loader2 } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, limit, Timestamp, orderBy } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';

interface Post {
  id: string;
  title: string;
  slug: string;
  content: string;
  createdAt: Date;
  authorName: string;
  isPublished: boolean;
  tags?: string[];
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
    tags: data.tags || [],
  };
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
      createdAt: (data.createdAt as Timestamp).toDate(),
      authorName: data.authorName,
      isPublished: data.isPublished,
      tags: data.tags || [],
    };
  });
}

export default function BlogPostPage({ params }: { params: { slug: string } }) {
  const [post, setPost] = useState<Post | null>(null);
  const [otherPosts, setOtherPosts] = useState<Post[]>([]);
  const [visiblePostsCount, setVisiblePostsCount] = useState(3);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPostData = async () => {
      setLoading(true);
      const fetchedPost = await getPost(params.slug);
      if (!fetchedPost) {
        notFound();
        return;
      }
      setPost(fetchedPost);

      const allPosts = await getPosts();
      setOtherPosts(allPosts.filter(p => p.id !== fetchedPost.id));
      setLoading(false);
    };

    fetchPostData();
  }, [params.slug]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!post) {
    return null; // notFound() is called in useEffect
  }
  
  const handleLoadMore = () => {
    setVisiblePostsCount(prevCount => prevCount + 3);
  };

  const visibleOtherPosts = otherPosts.slice(0, visiblePostsCount);

  return (
    <div className="bg-secondary/30 min-h-screen">
      <div className="container mx-auto py-8 px-4">
        <div className="max-w-4xl mx-auto">
            <Button asChild variant="ghost" className="mb-8">
                <Link href="/blog"><ArrowLeft className="mr-2"/> Back to Blog</Link>
            </Button>
            <div className="grid lg:grid-cols-4 gap-12">
                <article className="lg:col-span-4">
                    <header className="mb-8">
                        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-primary">{post.title}</h1>
                        <p className="mt-4 text-lg text-muted-foreground">
                            By {post.authorName} on {format(post.createdAt, 'MMMM d, yyyy')}
                        </p>
                    </header>
                    <Card>
                        <CardContent className="p-6 md:p-8">
                             <div
                                className="prose dark:prose-invert max-w-none prose-lg prose-p:mb-4 prose-headings:mt-8 prose-headings:mb-4 prose-ul:mb-4 prose-ol:mb-4 prose-blockquote:mb-4"
                                dangerouslySetInnerHTML={{ __html: post.content }}
                             />
                        </CardContent>
                    </Card>
                </article>

                <aside className="lg:col-span-4">
                  {post.tags && post.tags.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-xl"><Tag className="h-5 w-5"/> Health Tags</CardTitle>
                      </CardHeader>
                      <CardContent className="flex flex-wrap gap-2">
                        {post.tags.map(tag => (
                          <Badge key={tag} variant="secondary">{tag}</Badge>
                        ))}
                      </CardContent>
                    </Card>
                  )}
                </aside>
            </div>
        </div>

        {visibleOtherPosts.length > 0 && (
          <div className="mt-16 pt-12 border-t">
            <h2 className="text-3xl font-bold text-center mb-8">More Posts</h2>
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto">
              {visibleOtherPosts.map(p => (
                <Card key={p.id} className="flex flex-col bg-background">
                  <CardHeader>
                    <CardTitle className="text-2xl">{p.title}</CardTitle>
                    <CardDescription>
                      {format(p.createdAt, 'MMMM d, yyyy')}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex-grow">
                    <div
                      className="text-muted-foreground line-clamp-4 prose dark:prose-invert max-w-none"
                      dangerouslySetInnerHTML={{ __html: p.content }}
                    />
                  </CardContent>
                  <CardFooter>
                    <Button asChild variant="outline">
                      <Link href={`/blog/${p.slug}`}>Read More</Link>
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
            {visiblePostsCount < otherPosts.length && (
              <div className="text-center mt-12">
                <Button onClick={handleLoadMore} size="lg">
                  Load More Articles
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
