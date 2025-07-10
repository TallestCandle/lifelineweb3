
"use client";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader } from '@/components/ui/loader';

export default function DeprecatedAnalysisPage() {
    const router = useRouter();
    useEffect(() => {
        router.replace('/deep-dive');
    }, [router]);

    return <Loader />;
}
