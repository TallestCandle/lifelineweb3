"use client";

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { IAgoraRTCClient, ILocalVideoTrack, ILocalAudioTrack, IAgoraRTCRemoteUser } from 'agora-rtc-sdk-ng';
import AgoraRTC from 'agora-rtc-sdk-ng';

import { useProfile } from '@/context/profile-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Mic, MicOff, Video, VideoOff, PhoneOff, AlertTriangle } from 'lucide-react';
import { Loader } from '../ui/loader';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';

const appId = process.env.NEXT_PUBLIC_AGORA_APP_ID || '';
// For a production app, you would generate a token from your server.
// For this example, we'll use null for token-less authentication (works for testing).
const token = null;

interface AgoraCallProps {
  channelName: string;
}

export function AgoraCall({ channelName }: AgoraCallProps) {
  const router = useRouter();
  const { activeProfile } = useProfile();
  const { toast } = useToast();

  const client = useRef<IAgoraRTCClient | null>(null);
  const localAudioTrack = useRef<ILocalAudioTrack | null>(null);
  const localVideoTrack = useRef<ILocalVideoTrack | null>(null);
  
  const [remoteUsers, setRemoteUsers] = useState<IAgoraRTCRemoteUser[]>([]);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [isJoining, setIsJoining] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const localPlayerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!appId) {
      setError('Agora App ID is missing. Please contact support.');
      setIsJoining(false);
      return;
    }

    // Initialize Agora client
    client.current = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });

    const initAndJoin = async () => {
      try {
        const uid = await client.current!.join(appId, channelName, token, activeProfile?.id || null);

        // Create and publish local tracks
        [localAudioTrack.current, localVideoTrack.current] = await AgoraRTC.createMicrophoneAndCameraTracks();

        if (localPlayerRef.current) {
          localVideoTrack.current.play(localPlayerRef.current);
        }

        await client.current!.publish([localAudioTrack.current, localVideoTrack.current]);
        setIsJoining(false);
      } catch (err: any) {
        console.error('Failed to join channel or access media', err);
        if (err.code === 'PERMISSION_DENIED') {
            setError('Camera and microphone access denied. Please enable permissions in your browser settings.');
        } else {
            setError('Could not connect to the call. Please check your connection and try again.');
        }
        setIsJoining(false);
      }
    };

    const handleUserPublished = async (user: IAgoraRTCRemoteUser, mediaType: 'audio' | 'video') => {
      await client.current!.subscribe(user, mediaType);
      setRemoteUsers(Array.from(client.current!.remoteUsers));

      if (mediaType === 'video' && user.videoTrack) {
        const remoteVideoPlayer = document.getElementById(`remote-player-${user.uid}`);
        if (remoteVideoPlayer) {
          user.videoTrack.play(remoteVideoPlayer as HTMLElement);
        }
      }
      if (mediaType === 'audio') {
        user.audioTrack?.play();
      }
    };
    
    const handleUserUnpublished = (user: IAgoraRTCRemoteUser) => {
        setRemoteUsers(Array.from(client.current!.remoteUsers));
    };

    const handleUserLeft = (user: IAgoraRTCRemoteUser) => {
      setRemoteUsers(currentUsers => currentUsers.filter(u => u.uid !== user.uid));
    };

    client.current.on('user-published', handleUserPublished);
    client.current.on('user-unpublished', handleUserUnpublished);
    client.current.on('user-left', handleUserLeft);

    initAndJoin();

    return () => {
      localAudioTrack.current?.close();
      localVideoTrack.current?.close();
      client.current?.leave();
      client.current?.removeAllListeners();
    };
  }, [channelName, activeProfile, toast]);

  const handleLeave = async () => {
    try {
      localAudioTrack.current?.close();
      localVideoTrack.current?.close();
      await client.current?.leave();
      router.push('/');
    } catch (error) {
      console.error('Failed to leave channel', error);
    }
  };

  const handleToggleAudio = async () => {
    if (localAudioTrack.current) {
      await localAudioTrack.current.setMuted(!isAudioMuted);
      setIsAudioMuted(!isAudioMuted);
    }
  };

  const handleToggleVideo = async () => {
    if (localVideoTrack.current) {
      await localVideoTrack.current.setMuted(!isVideoMuted);
      setIsVideoMuted(!isVideoMuted);
    }
  };

  if (isJoining) {
    return (
        <div className="flex flex-col items-center justify-center h-screen bg-background">
            <Loader />
            <p className="mt-4 text-muted-foreground">Connecting to your doctor...</p>
        </div>
    );
  }

  if (error) {
     return (
        <div className="flex flex-col items-center justify-center h-screen bg-background p-4">
            <Alert variant="destructive" className="max-w-md">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Connection Failed</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
            </Alert>
            <Button onClick={() => router.push('/')} className="mt-4">Go to Dashboard</Button>
        </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-black flex flex-col p-4 relative">
        <div className="flex-grow grid grid-cols-1 md:grid-cols-2 gap-4">
            {remoteUsers.length > 0 ? (
                remoteUsers.map(user => (
                    <Card key={user.uid} className="overflow-hidden bg-secondary w-full h-full">
                        <div id={`remote-player-${user.uid}`} className="w-full h-full" />
                    </Card>
                ))
            ) : (
                <div className="flex items-center justify-center bg-secondary rounded-lg">
                    <p className="text-muted-foreground">Waiting for the doctor to join...</p>
                </div>
            )}
        </div>

        <div 
            ref={localPlayerRef} 
            className="absolute bottom-24 right-4 md:bottom-28 md:right-8 w-32 h-48 md:w-48 md:h-64 bg-black border-2 border-primary rounded-lg overflow-hidden shadow-lg z-10"
        />

        <div className="absolute bottom-0 left-0 right-0 p-4 flex justify-center z-20">
            <div className="flex items-center gap-4 bg-background/80 backdrop-blur-sm p-4 rounded-full shadow-lg">
                <Button variant={isAudioMuted ? 'destructive' : 'secondary'} size="icon" className="rounded-full w-14 h-14" onClick={handleToggleAudio}>
                    {isAudioMuted ? <MicOff /> : <Mic />}
                </Button>
                <Button variant={isVideoMuted ? 'destructive' : 'secondary'} size="icon" className="rounded-full w-14 h-14" onClick={handleToggleVideo}>
                    {isVideoMuted ? <VideoOff /> : <Video />}
                </Button>
                 <Button variant="destructive" size="icon" className="rounded-full w-16 h-16" onClick={handleLeave}>
                    <PhoneOff />
                </Button>
            </div>
        </div>
    </div>
  );
}
