"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import type { RtcProps } from 'agora-react-uikit';

import { Button } from '@/components/ui/button';
import { Loader } from '../ui/loader';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { AlertTriangle } from 'lucide-react';

const AgoraUIKit = dynamic(() => import('agora-react-uikit'), {
    ssr: false,
    loading: () => <div className="flex flex-col items-center justify-center h-screen bg-background">
        <Loader />
        <p className="mt-4 text-muted-foreground">Loading Call Interface...</p>
    </div>
});

const appId = process.env.NEXT_PUBLIC_AGORA_APP_ID || '';

interface AgoraCallProps {
  channelName: string;
}

export function AgoraCall({ channelName }: AgoraCallProps) {
  const router = useRouter();
  const [videoCall, setVideoCall] = useState(true);

  if (!appId) {
    return (
        <div className="flex flex-col items-center justify-center h-screen bg-background p-4">
            <Alert variant="destructive" className="max-w-md">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Configuration Error</AlertTitle>
                <AlertDescription>Agora App ID is missing. Please configure it in your environment variables.</AlertDescription>
            </Alert>
            <Button onClick={() => router.push('/')} className="mt-4">Go to Dashboard</Button>
        </div>
    );
  }

  const rtcProps: RtcProps = {
    appId,
    channel: channelName,
    token: null, // For production, generate a token from your server
  };

  const callbacks = {
    EndCall: () => {
        setVideoCall(false);
        router.push('/');
    },
  };

  if (!videoCall) {
      return (
          <div className="flex flex-col items-center justify-center h-screen bg-background">
              <Loader />
              <p className="mt-4 text-muted-foreground">Call ended. Redirecting...</p>
          </div>
      );
  }

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh' }}>
      <AgoraUIKit rtcProps={rtcProps} callbacks={callbacks} />
    </div>
  );
}
