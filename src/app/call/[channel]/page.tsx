"use client";

import { AgoraCall } from "@/components/call/agora-call";
import { Loader } from "@/components/ui/loader";
import { useParams } from 'next/navigation';
import { Suspense } from "react";

function CallPageContent() {
    const params = useParams();
    const channelName = Array.isArray(params.channel) ? params.channel[0] : params.channel;

    if (!channelName) {
        return <div className="flex items-center justify-center h-screen">Invalid channel.</div>;
    }

    return <AgoraCall channelName={channelName} />;
}


export default function CallPage() {
    return (
        <Suspense fallback={<Loader />}>
            <CallPageContent />
        </Suspense>
    );
}
