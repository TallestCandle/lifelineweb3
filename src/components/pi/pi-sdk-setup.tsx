'use client';

import Script from 'next/script';
import { useEffect } from 'react';

export default function PiSDKSetup() {
  useEffect(() => {
    // Handle HTTPS redirect
    if (typeof window !== 'undefined' && 
        location.protocol !== 'https:' && 
        location.hostname !== 'localhost' && 
        location.hostname !== '127.0.0.1') {
      location.replace('https:' + window.location.href.substring(window.location.protocol.length));
    }

    // Global error handler for Pi SDK
    const handleError = (e: ErrorEvent) => {
      if (e.message && e.message.includes('Pi')) {
        console.error('Pi SDK Error:', e.message);
      }
    };

    window.addEventListener('error', handleError);

    return () => {
      window.removeEventListener('error', handleError);
    };
  }, []);

  const isLocalDev = typeof window !== 'undefined' && 
    (window.location.hostname === 'localhost' || 
     window.location.hostname === '127.0.0.1');

  // Always use sandbox mode in development
  const useSandbox = process.env.NODE_ENV === 'development' || isLocalDev;

  return (
    <>
      {/* Preconnect to Pi Network domains */}
      <link rel="preconnect" href="https://api.minepi.com" />
      <link rel="preconnect" href="https://sdk.minepi.com" />

      {/* Pi Network App Manifest */}
      <meta name="pi:sandbox" content={useSandbox ? 'true' : 'false'} />
      <meta name="pi:app_id" content="sandbox" />

      {/* Open Graph tags */}
      <meta property="og:title" content="Lifeline" />
      <meta property="og:description" content="Your personal health companion powered by Pi Network" />
      <meta property="og:type" content="website" />

      {/* Development mode indicator */}
      {useSandbox && (
        <meta name="pi:development" content="true" />
      )}
    </>
  );
}
