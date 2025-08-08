
"use client";

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, doc, getDoc, setDoc } from 'firebase/firestore';
import { useAuth } from '@/context/auth-provider';
import { useProfile } from '@/context/profile-provider';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import Image from 'next/image';
import { Loader2, BookOpen, CheckCircle } from 'lucide-react';
import { Skeleton } from '../ui/skeleton';
import Link from 'next/link';

interface Ebook {
  id: string;
  title: string;
  description: string;
  price: number;
  coverImageUrl: string;
  ebookFileUrl: string;
  isPublished: boolean;
}

export function EbookStore() {
  const { user } = useAuth();
  const { profile, updateBalance } = useProfile();
  const { toast } = useToast();

  const [ebooks, setEbooks] = useState<Ebook[]>([]);
  const [purchasedEbookIds, setPurchasedEbookIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isPurchasing, setIsPurchasing] = useState<string | null>(null);

  useEffect(() => {
    const fetchEbooks = async () => {
      setIsLoading(true);
      try {
        const q = query(collection(db, 'ebooks'), where("isPublished", "==", true));
        const querySnapshot = await getDocs(q);
        setEbooks(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Ebook)));

        if (user) {
          const purchasesCollectionRef = collection(db, `users/${user.uid}/purchased_ebooks`);
          const purchasesSnapshot = await getDocs(purchasesCollectionRef);
          setPurchasedEbookIds(new Set(purchasesSnapshot.docs.map(doc => doc.id)));
        }
      } catch (error) {
        toast({ variant: 'destructive', title: 'Error', description: 'Could not load ebooks.' });
      } finally {
        setIsLoading(false);
      }
    };
    fetchEbooks();
  }, [user, toast]);

  const handlePurchase = async (ebook: Ebook) => {
    if (!user || !profile) {
      toast({ variant: 'destructive', title: 'Error', description: 'You must be logged in to purchase.' });
      return;
    }
    if (profile.balance < ebook.price) {
      toast({ variant: 'destructive', title: 'Insufficient Funds', description: 'Please top up your wallet to purchase this ebook.' });
      return;
    }

    setIsPurchasing(ebook.id);
    try {
      await updateBalance(-ebook.price, `Purchase of ebook: ${ebook.title}`);
      
      const purchaseRef = doc(db, `users/${user.uid}/purchased_ebooks`, ebook.id);
      await setDoc(purchaseRef, {
        purchasedAt: new Date().toISOString(),
        title: ebook.title,
        price: ebook.price,
      });

      setPurchasedEbookIds(prev => new Set(prev).add(ebook.id));
      toast({ title: 'Purchase Successful!', description: `You can now read "${ebook.title}".` });
    } catch (error) {
      console.error("Purchase failed:", error);
      toast({ variant: 'destructive', title: 'Purchase Failed', description: 'Could not complete the transaction.' });
      // Refund if balance update went through but Firestore write failed
      await updateBalance(ebook.price, `Refund for failed purchase: ${ebook.title}`);
    } finally {
      setIsPurchasing(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <BookOpen className="w-8 h-8 text-primary" />
            <span className="text-2xl">Ebook Store</span>
          </CardTitle>
          <CardDescription>
            Expand your knowledge with our curated collection of health and wellness ebooks.
          </CardDescription>
        </CardHeader>
      </Card>
      
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i}><CardContent className="p-4"><Skeleton className="aspect-[3/4] w-full"/><Skeleton className="h-5 w-3/4 mt-4"/><Skeleton className="h-4 w-1/2 mt-2"/></CardContent></Card>
          ))}
        </div>
      ) : ebooks.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {ebooks.map(ebook => (
            <Card key={ebook.id} className="flex flex-col">
              <CardHeader className="p-0">
                <div className="relative aspect-[3/4]">
                  <Image src={ebook.coverImageUrl} alt={ebook.title} layout="fill" objectFit="cover" className="rounded-t-lg" data-ai-hint="book cover" />
                </div>
              </CardHeader>
              <CardContent className="p-4 flex-grow">
                <CardTitle className="text-lg line-clamp-2">{ebook.title}</CardTitle>
                <CardDescription className="text-sm mt-2 line-clamp-3">{ebook.description}</CardDescription>
              </CardContent>
              <CardFooter className="p-4 flex flex-col items-stretch">
                <p className="font-bold text-xl text-primary mb-4 text-center">₦{ebook.price.toLocaleString()}</p>
                {purchasedEbookIds.has(ebook.id) ? (
                  <Button asChild variant="secondary">
                    <Link href={ebook.ebookFileUrl} target="_blank" rel="noopener noreferrer">
                      <CheckCircle className="mr-2"/> Read Now
                    </Link>
                  </Button>
                ) : (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button disabled={isPurchasing === ebook.id}>
                        {isPurchasing === ebook.id && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                        Buy Now
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Confirm Purchase</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to buy "{ebook.title}" for ₦{ebook.price.toLocaleString()}? This amount will be deducted from your wallet balance.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handlePurchase(ebook)}>Confirm & Buy</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <p className="text-center text-muted-foreground py-8">The ebook store is currently empty. Check back later!</p>
      )}
    </div>
  );
}
