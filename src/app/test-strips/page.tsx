"use client";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader } from '@/components/ui/loader';

export default function DeprecatedTestStripsPage() {
    const router = useRouter();
    useEffect(() => {
        router.replace('/log');
    }, [router]);

    return <Loader />;
}
