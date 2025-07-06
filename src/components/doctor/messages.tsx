
"use client";

import { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from "@/context/auth-provider";
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, orderBy, addDoc, doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, User, Send, Bot } from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface Investigation {
  id: string;
  userId: string;
  userName: string;
  reviewedByUid?: string;
  createdAt: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'doctor';
  content: string;
  timestamp: string;
  authorName: string;
}

function ChatPanel({ investigationId, patientName }: { investigationId: string, patientName: string }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(true);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!investigationId) {
      setIsChatLoading(false);
      setMessages([]);
      return;
    }
    
    setIsChatLoading(true);
    const messagesCol = collection(db, `investigations/${investigationId}/messages`);
    const q = query(messagesCol, orderBy("timestamp", "asc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatMessage)));
      setIsChatLoading(false);
    }, (error) => {
      console.error("Chat Error: ", error);
      setIsChatLoading(false);
    });

    return () => unsubscribe();
  }, [investigationId]);
  
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.parentElement?.scrollTo({ top: scrollAreaRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages]);


  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || !investigationId) return;

    const messagesCol = collection(db, `investigations/${investigationId}/messages`);
    await addDoc(messagesCol, {
      role: 'doctor',
      content: newMessage,
      timestamp: new Date().toISOString(),
      authorId: user.uid,
      authorName: user.displayName || 'Doctor',
    });
    setNewMessage("");
  };
  
  if (!investigationId) {
    return (
        <div className="flex flex-col items-center justify-center h-full text-center">
            <User className="w-12 h-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">Select a conversation</h3>
            <p className="text-muted-foreground">Choose a patient from the list to view their messages.</p>
        </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
        <CardHeader>
            <CardTitle>{patientName}</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 p-0 overflow-hidden">
            <ScrollArea className="h-full px-4" ref={scrollAreaRef}>
            <div className="space-y-4">
                {isChatLoading && <Loader2 className="animate-spin mx-auto"/>}
                {!isChatLoading && messages.length === 0 && (
                <p className="text-center text-sm text-muted-foreground pt-4">No messages yet. Send a welcome message!</p>
                )}
                {messages.map((message) => (
                <div key={message.id} className={`flex items-end gap-2 ${message.role === 'doctor' ? 'justify-end' : 'justify-start'}`}>
                    {message.role === 'user' && <Avatar className="w-8 h-8"><AvatarFallback>{message.authorName.charAt(0)}</AvatarFallback></Avatar>}
                    <div className={`max-w-[80%] rounded-lg p-3 ${message.role === 'doctor' ? 'bg-primary text-primary-foreground' : 'bg-secondary'}`}>
                    <p className="whitespace-pre-wrap">{message.content}</p>
                    </div>
                    {message.role === 'doctor' && <Avatar className="w-8 h-8"><AvatarFallback><Bot size={20}/></AvatarFallback></Avatar>}
                </div>
                ))}
            </div>
            </ScrollArea>
        </CardContent>
        <CardFooter className="p-4 border-t">
            <form onSubmit={handleSendMessage} className="w-full flex items-center gap-2">
            <Input value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Type a message..." />
            <Button type="submit" size="icon"><Send /></Button>
            </form>
      </CardFooter>
    </div>
  );
}


export function MessagesDashboard() {
  const { user } = useAuth();
  const [investigations, setInvestigations] = useState<Investigation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedInvestigationId, setSelectedInvestigationId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
        setIsLoading(false);
        return;
    }
    
    setIsLoading(true);
    const q = query(
        collection(db, "investigations"), 
        where("reviewedByUid", "==", user.uid),
        orderBy("createdAt", "desc")
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Investigation));
        setInvestigations(fetched);
        setIsLoading(false);
    }, (error) => {
        console.error("Error fetching investigations: ", error);
        setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const selectedInvestigation = useMemo(() => {
      return investigations.find(inv => inv.id === selectedInvestigationId);
  }, [investigations, selectedInvestigationId]);
  
  if (isLoading) {
      return (
          <div className="flex items-center justify-center h-full">
              <Loader2 className="w-12 h-12 animate-spin text-primary" />
          </div>
      );
  }

  return (
    <div className="h-[calc(100vh-10rem)]">
        <Card className="h-full grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4">
            <div className="col-span-1 border-r flex flex-col">
                <CardHeader>
                    <CardTitle>Conversations</CardTitle>
                </CardHeader>
                <ScrollArea className="flex-1 px-2">
                    <div className="space-y-2">
                        {investigations.length === 0 && (
                             <p className="text-center text-sm text-muted-foreground pt-4">You have no active patient conversations.</p>
                        )}
                        {investigations.map(inv => (
                            <button 
                                key={inv.id} 
                                className={cn(
                                    "w-full text-left p-3 rounded-lg flex items-center gap-3 transition-colors",
                                    selectedInvestigationId === inv.id ? "bg-primary text-primary-foreground" : "hover:bg-secondary"
                                )}
                                onClick={() => setSelectedInvestigationId(inv.id)}
                            >
                                <Avatar><AvatarFallback>{inv.userName.charAt(0)}</AvatarFallback></Avatar>
                                <div>
                                    <p className="font-bold">{inv.userName}</p>
                                    <p className={cn("text-xs", selectedInvestigationId === inv.id ? "text-primary-foreground/80" : "text-muted-foreground")}>
                                        Case started {formatDistanceToNow(parseISO(inv.createdAt), { addSuffix: true })}
                                    </p>
                                </div>
                            </button>
                        ))}
                    </div>
                </ScrollArea>
            </div>
            <div className="col-span-1 md:col-span-2 lg:col-span-3">
                <ChatPanel 
                    investigationId={selectedInvestigation?.id || ""} 
                    patientName={selectedInvestigation?.userName || ""} 
                />
            </div>
        </Card>
    </div>
  );
}
