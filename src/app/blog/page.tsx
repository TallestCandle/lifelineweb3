
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowRight, Newspaper, Stethoscope } from 'lucide-react';
import Image from 'next/image';

interface Post {
  id: string;
  title: string;
  slug: string;
  content: string; // Markdown string
  createdAt: Date;
  authorName: string;
}

// Hardcoded posts to give a real feel for the blog
const posts: Post[] = [
  {
    id: '1',
    title: 'The Future of Health is Proactive, Not Reactive',
    slug: 'future-of-health-proactive',
    content: "For decades, healthcare has followed a simple model: you get sick, you see a doctor, you get treated. But what if we could shift from this reactive stance to a proactive one? What if we could identify the subtle signs of disease long before they become life-altering events?\n\nThis is the promise of proactive health, a revolution powered by technology like Lifeline AI. By continuously monitoring key biomarkers, our platform helps you and your doctor see the invisible patterns and trends in your health, allowing for interventions that can prevent major health crises like strokes, heart attacks, and kidney failure. It's about moving from treating illness to cultivating wellness.",
    createdAt: new Date('2024-07-15T10:00:00Z'),
    authorName: 'Dr. Evelyn Reed',
  },
  {
    id: '2',
    title: 'Understanding Your Vitals: More Than Just Numbers',
    slug: 'understanding-your-vitals',
    content: "Your blood pressure, heart rate, and blood sugar are more than just numbers on a screen; they are a direct line of communication from your body. A single high reading might not be a cause for alarm, but a consistent upward trend can be an early warning sign of serious conditions. Lifeline AI's Deep Dive feature helps you understand these trends. Are your blood pressure readings higher on workdays? Does your blood sugar spike after certain meals? Uncovering these correlations is the first step toward making targeted lifestyle changes that can have a massive impact on your long-term health.",
    createdAt: new Date('2024-07-10T09:00:00Z'),
    authorName: 'Dr. Ben Carter',
  },
  {
    id: '3',
    title: 'AI in Healthcare: Separating Hype from Reality',
    slug: 'ai-in-healthcare-hype-vs-reality',
    content: "Artificial intelligence is poised to transform healthcare, but it's important to understand its role. AI is not a replacement for your doctor. Instead, think of it as a powerful assistant that can analyze vast amounts of data to find patterns a human might miss. At Lifeline AI, our system serves as a diagnostic aid, flagging potential risks and suggesting avenues for investigation. This allows your doctor to focus their expertise on diagnosis and treatment, armed with deeper insights into your health. The synergy between human expertise and AI analysis is where the magic happens.",
    createdAt: new Date('2024-07-05T14:00:00Z'),
    authorName: 'Tunde Adebayo',
  },
  {
    id: '4',
    title: 'The Simple Urine Test That Could Save Your Life',
    slug: 'simple-urine-test',
    content: "The humble urine test strip is one of the most powerful and underrated tools in proactive health. With just a small sample, it can provide clues about your kidney function, hydration levels, metabolic health, and even signal infections. Consistently tracking markers like protein, glucose, and ketones can reveal the earliest signs of chronic kidney disease or diabetes. Lifeline AI makes this process simple, allowing you to log your results and track them over time, transforming a simple test into a vital part of your health-monitoring arsenal.",
    createdAt: new Date('2024-06-28T11:00:00Z'),
    authorName: 'Dr. Evelyn Reed',
  },
];

// Function to extract the first paragraph
function getFirstParagraph(content: string): string {
  const firstParagraph = content.split('\n\n')[0];
  return firstParagraph || '';
}

export default async function BlogListPage() {
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
                            <CardDescription className="mb-6 line-clamp-3">
                                {getFirstParagraph(featuredPost.content)}
                            </CardDescription>
                            <p className="text-sm text-muted-foreground mb-6">
                                By {featuredPost.authorName} on {format(featuredPost.createdAt, 'MMMM d, yyyy')}
                            </p>
                            <Button asChild className="self-start">
                                <Link href={`/blog/${featuredPost.slug}`}>Read More <ArrowRight className="ml-2"/></Link>
                            </Button>
                        </div>
                        <div className="bg-primary/10 min-h-64 md:min-h-full flex items-center justify-center p-4">
                            <Image 
                                src="https://placehold.co/600x400.png"
                                alt="Featured post placeholder"
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
                            <p className="text-muted-foreground line-clamp-4">
                                 {getFirstParagraph(post.content)}
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

    