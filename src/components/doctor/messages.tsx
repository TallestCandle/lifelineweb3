
"use client";

import { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from "@/context/auth-provider";
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, orderBy, addDoc, doc, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, User, Send, Bot, ArrowLeft, Pencil } from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { useIsMobile } from '@/hooks/use-mobile';
import { Textarea } from '@/components/ui/textarea';


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
  authorId: string;
  authorName: string;
  edited?: boolean;
}

interface ChatPanelProps {
    investigationId: string;
    patientName: string;
    onBack?: () => void;
}

function ChatPanel({ investigationId, patientName, onBack }: ChatPanelProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const [editingMessage, setEditingMessage] = useState<{id: string, content: string} | null>(null);

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
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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
  
  const handleStartEdit = (message: ChatMessage) => {
    setEditingMessage({ id: message.id, content: message.content });
  };
  
  const handleCancelEdit = () => {
    setEditingMessage(null);
  };

  const handleSaveEdit = async () => {
      if (!editingMessage || !user || !investigationId) return;
  
      const messageRef = doc(db, `investigations/${investigationId}/messages`, editingMessage.id);
      await updateDoc(messageRef, {
          content: editingMessage.content,
          edited: true,
          editedAt: new Date().toISOString(),
      });
  
      setEditingMessage(null);
  };

  if (!investigationId && !isMobile) {
    return (
        <div className="flex flex-col items-center justify-center h-full text-center">
            <User className="w-12 h-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">Select a conversation</h3>
            <p className="text-muted-foreground">Choose a patient from the list to view their messages.</p>
        </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full">
        <CardHeader className="flex flex-row items-center gap-4">
            {isMobile && onBack && (
                <Button variant="ghost" size="icon" onClick={onBack}>
                    <ArrowLeft />
                    <span className="sr-only">Back</span>
                </Button>
            )}
            <CardTitle>{patientName}</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 p-0 overflow-hidden">
            <ScrollArea className="h-full px-4">
                <div className="space-y-4">
                    {isChatLoading && <Loader2 className="animate-spin mx-auto"/>}
                    {!isChatLoading && messages.length === 0 && (
                        <p className="text-center text-sm text-muted-foreground pt-4">No messages yet. Send a welcome message!</p>
                    )}
                    {messages.map((message) => {
                      const isMyMessage = message.authorId === user?.uid;

                      if (editingMessage?.id === message.id && isMyMessage) {
                        return (
                          <div key={message.id} className="flex items-end gap-2 justify-end w-full">
                            <div className="w-full max-w-[80%] space-y-2">
                                <Textarea 
                                    value={editingMessage.content} 
                                    onChange={(e) => setEditingMessage(prev => prev ? {...prev, content: e.target.value} : null)}
                                    className="bg-background"
                                    rows={3}
                                />
                                <div className="flex justify-end gap-2">
                                    <Button variant="ghost" size="sm" onClick={handleCancelEdit}>Cancel</Button>
                                    <Button size="sm" onClick={handleSaveEdit}>Save changes</Button>
                                </div>
                            </div>
                            <Avatar className="w-8 h-8"><AvatarFallback><Bot size={20}/></AvatarFallback></Avatar>
                          </div>
                        )
                      }
                      
                      return (
                        <div key={message.id} className={`group flex items-end gap-2 ${isMyMessage ? 'justify-end' : 'justify-start'}`}>
                            {isMyMessage && 
                                <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleStartEdit(message)}>
                                    <Pencil size={14} />
                                    <span className="sr-only">Edit</span>
                                </Button>
                            }
                            {message.role === 'user' && <Avatar className="w-8 h-8"><AvatarFallback>{message.authorName.charAt(0)}</AvatarFallback></Avatar>}
                            <div className={`max-w-[80%] rounded-lg p-3 ${message.role === 'doctor' ? 'bg-primary text-primary-foreground' : 'bg-secondary'}`}>
                                <p className="whitespace-pre-wrap">{message.content}</p>
                                {message.edited && <span className="text-xs opacity-70 mt-1 block">(edited)</span>}
                            </div>
                            {message.role === 'doctor' && <Avatar className="w-8 h-8"><AvatarFallback><Bot size={20}/></AvatarFallback></Avatar>}
                        </div>
                      )
                    })}
                    <div ref={messagesEndRef} />
                </div>
            </ScrollArea>
        </CardContent>
        <CardFooter className="p-4 border-t">
            <form onSubmit={handleSendMessage} className="w-full flex items-center gap-2">
            <Input value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Type a message..." disabled={!!editingMessage}/>
            <Button type="submit" size="icon" disabled={!!editingMessage}><Send /></Button>
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
  const isMobile = useIsMobile();

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
        if (!isMobile && !selectedInvestigationId && fetched.length > 0) {
            setSelectedInvestigationId(fetched[0].id);
        }
        setIsLoading(false);
    }, (error) => {
        console.error("Error fetching investigations: ", error);
        setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user, isMobile, selectedInvestigationId]);

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
        <Card className="h-full flex overflow-hidden">
            <div className={cn(
                "border-r flex-col w-full md:w-[320px] lg:w-[380px] shrink-0",
                isMobile && selectedInvestigationId ? 'hidden' : 'flex'
            )}>
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
            <div className={cn(
                "flex-col flex-1",
                isMobile && !selectedInvestigationId ? 'hidden' : 'flex'
            )}>
                <ChatPanel 
                    investigationId={selectedInvestigation?.id || ""} 
                    patientName={selectedInvestigation?.userName || ""} 
                    onBack={() => setSelectedInvestigationId(null)}
                />
            </div>
        </Card>
    </div>
  );
}
