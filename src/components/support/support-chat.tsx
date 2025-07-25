
"use client";

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { answerSystemQuestion, type SystemSupportOutput } from '@/ai/flows/system-support-flow';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Textarea } from '@/components/ui/textarea';
import { Bot, LifeBuoy, Send, Loader2, User } from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';

interface Message {
  role: 'user' | 'model';
  content: string;
}

const formSchema = z.object({
  query: z.string().min(5, { message: "Please enter a detailed question." }),
});

type FormValues = z.infer<typeof formSchema>;

export function SupportChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { query: "" },
  });

  const onSubmit = async (data: FormValues) => {
    setIsLoading(true);
    const newMessages: Message[] = [...messages, { role: 'user', content: data.query }];
    setMessages(newMessages);

    try {
      const result: SystemSupportOutput = await answerSystemQuestion({ query: data.query });
      setMessages([...newMessages, { role: 'model', content: result.answer }]);
      form.reset();
    } catch (error) {
      console.error("Support AI failed:", error);
      setMessages([...newMessages, { role: 'model', content: "I'm sorry, an error occurred. I couldn't process your request. Please try again." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
        <Card className="flex-grow flex flex-col">
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><LifeBuoy/> AI Support Assistant</CardTitle>
                <CardDescription>Have a question about the app? Ask me anything about how Nexus Lifeline works.</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow flex flex-col gap-4 overflow-hidden p-0">
                <ScrollArea className="flex-grow p-6">
                    <div className="space-y-6">
                    {messages.length === 0 && (
                        <Alert>
                            <Bot className="h-4 w-4" />
                            <AlertTitle>Welcome to Support!</AlertTitle>
                            <AlertDescription>
                                You can ask me questions like:
                                <ul className="list-disc list-inside mt-2">
                                    <li>How do I log my blood pressure?</li>
                                    <li>What does the "Deep Dive" feature do?</li>
                                    <li>How does the Clinic work?</li>
                                </ul>
                            </AlertDescription>
                        </Alert>
                    )}
                    {messages.map((message, index) => (
                         <div key={index} className={`flex items-start gap-3 ${message.role === 'user' ? 'justify-end' : ''}`}>
                            {message.role === 'model' && <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 text-primary hidden sm:flex items-center justify-center"><Bot size={20}/></div>}
                            <div className={`max-w-2xl rounded-lg p-3 ${message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-secondary'}`}>
                                <ReactMarkdown remarkPlugins={[remarkGfm]} className="prose prose-sm dark:prose-invert prose-p:my-0">
                                    {message.content}
                                </ReactMarkdown>
                            </div>
                            {message.role === 'user' && <div className="flex-shrink-0 w-8 h-8 rounded-full bg-secondary text-secondary-foreground hidden sm:flex items-center justify-center"><User size={20}/></div>}
                        </div>
                    ))}
                     {isLoading && (
                        <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 text-primary hidden sm:flex items-center justify-center"><Bot size={20}/></div>
                            <div className="max-w-2xl rounded-lg p-3 bg-secondary flex items-center">
                                <Loader2 className="animate-spin w-5 h-5"/>
                            </div>
                        </div>
                     )}
                    </div>
                </ScrollArea>
                <div className="p-4 border-t">
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="flex items-start gap-4">
                            <FormField
                            control={form.control}
                            name="query"
                            render={({ field }) => (
                                <FormItem className="flex-grow">
                                <FormControl>
                                    <Textarea
                                        placeholder="Ask about a feature..."
                                        className="resize-none"
                                        rows={2}
                                        {...field}
                                    />
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                            />
                            <Button type="submit" disabled={isLoading} size="lg"><Send/></Button>
                        </form>
                    </Form>
                </div>
            </CardContent>
        </Card>
    </div>
  );
}
