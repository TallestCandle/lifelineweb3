import { PiAuthError, PiNetworkUser } from '@/types/auth';

declare global {
  interface Window {
    Pi?: {
      init: ({ version, sandbox }: { version: string; sandbox: boolean }) => void;
      authenticate: (scopes: string[], onIncompletePaymentFound?: (payment: any) => void) => Promise<PiNetworkUser>;
    };
  }
}

export async function loadPiSDK(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new PiAuthError('Cannot load Pi SDK in server-side context', 'SERVER_SIDE_LOAD'));
      return;
    }

    // If already loaded, resolve immediately
    if (typeof window.Pi !== 'undefined') {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://sdk.minepi.com/pi-sdk.js';
    script.async = true;

    script.onerror = () => {
      reject(new PiAuthError('Failed to load Pi SDK. Please ensure you are using the Pi Browser.', 'SDK_LOAD_FAILED'));
    };

    script.onload = () => {
      console.log('Pi SDK loaded successfully');
      resolve();
    };

    document.head.appendChild(script);
  });
}

export async function initPiSDK(sandbox: boolean = false): Promise<void> {
  try {
    await loadPiSDK();

    // Wait for Pi object to be available
    let retries = 0;
    const maxRetries = 10;
    
    while (!window.Pi && retries < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, 500));
      retries++;
    }

    if (!window.Pi) {
      throw new PiAuthError('Pi SDK not available. Please ensure you are using the Pi Browser.', 'SDK_NOT_AVAILABLE');
    }

    window.Pi.init({ version: '2.0', sandbox });
    console.log('Pi SDK initialized in', sandbox ? 'sandbox' : 'production', 'mode');
  } catch (error: any) {
    console.error('Failed to initialize Pi SDK:', error);
    throw error instanceof PiAuthError ? error : new PiAuthError('Failed to initialize Pi SDK', 'SDK_INIT_FAILED');
  }
}
