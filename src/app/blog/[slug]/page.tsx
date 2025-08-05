
import { notFound } from 'next/navigation';
import { format } from 'date-fns';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Card, CardContent } from '@/components/ui/card';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

interface Post {
  id: string;
  title: string;
  slug: string;
  content: string;
  createdAt: Date;
  authorName: string;
}

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
    content: "Your blood pressure, heart rate, and blood sugar are more than just numbers on a screen; they are a direct line of communication from your body. A single high reading might not be a cause for alarm, but a consistent upward trend can be an early warning sign of serious conditions.\n\nLifeline AI's Deep Dive feature helps you understand these trends. Are your blood pressure readings higher on workdays? Does your blood sugar spike after certain meals? Uncovering these correlations is the first step toward making targeted lifestyle changes that can have a massive impact on your long-term health.",
    createdAt: new Date('2024-07-10T09:00:00Z'),
    authorName: 'Dr. Ben Carter',
  },
  {
    id: '3',
    title: 'AI in Healthcare: Separating Hype from Reality',
    slug: 'ai-in-healthcare-hype-vs-reality',
    content: "Artificial intelligence is poised to transform healthcare, but it's important to understand its role. AI is not a replacement for your doctor. Instead, think of it as a powerful assistant that can analyze vast amounts of data to find patterns a human might miss.\n\nAt Lifeline AI, our system serves as a diagnostic aid, flagging potential risks and suggesting avenues for investigation. This allows your doctor to focus their expertise on diagnosis and treatment, armed with deeper insights into your health. The synergy between human expertise and AI analysis is where the magic happens.",
    createdAt: new Date('2024-07-05T14:00:00Z'),
    authorName: 'Tunde Adebayo',
  },
  {
    id: '4',
    title: 'The Simple Urine Test That Could Save Your Life',
    slug: 'simple-urine-test',
    content: "The humble urine test strip is one of the most powerful and underrated tools in proactive health. With just a small sample, it can provide clues about your kidney function, hydration levels, metabolic health, and even signal infections.\n\nConsistently tracking markers like protein, glucose, and ketones can reveal the earliest signs of chronic kidney disease or diabetes. Lifeline AI makes this process simple, allowing you to log your results and track them over time, transforming a simple test into a vital part of your health-monitoring arsenal.",
    createdAt: new Date('2024-06-28T11:00:00Z'),
    authorName: 'Dr. Evelyn Reed',
  },
];


async function getPost(slug: string) {
  return posts.find(p => p.slug === slug) || null;
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
                         <div className="prose dark:prose-invert max-w-none prose-lg">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {post.content}
                            </ReactMarkdown>
                        </div>
                    </CardContent>
                </Card>
            </article>
        </div>
    </div>
  );
}
