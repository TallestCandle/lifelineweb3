
"use client";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader } from '@/components/ui/loader';

export default function DeprecatedAdmissionPage() {
    const router = useRouter();
    useEffect(() => {
        router.replace('/clinic');
    }, [router]);

    return <Loader />;
}
