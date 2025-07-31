
"use client";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader } from '@/components/ui/loader';

// This page has been removed. Redirect to the dashboard.
export default function RemovedGeneticsPage() {
    const router = useRouter();
    useEffect(() => {
        router.replace('/');
    }, [router]);

    return <Loader />;
}
