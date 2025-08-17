import { PiAuthError } from '../types/auth';

interface PiPayment {
  identifier: string;
  user_uid: string;
  amount: number;
  memo: string;
  metadata?: Record<string, any>;
  status: {
    developer_approved: boolean;
    transaction_verified: boolean;
    developer_completed: boolean;
    cancelled: boolean;
    user_cancelled: boolean;
  };
  transaction?: {
    txid: string;
    verified: boolean;
  };
  created_at: string;
}

interface PiPaymentData {
  amount: number;
  memo: string;
  metadata?: Record<string, any>;
  uid?: string;
}

declare global {
  interface Window {
    Pi?: {
      init: ({ version, sandbox }: { version: string; sandbox: boolean }) => void;
      authenticate: (
        scopes: Array<'username' | 'payments' | 'wallet_address'>,
        callbacks?: {
          onReadyForServerApproval?: (successCallback: () => void) => void;
          onCancel?: () => void;
          onIncompletePaymentFound?: (payment: PiPayment) => Promise<void>;
        }
      ) => Promise<{
        user: {
          uid: string;
          username: string;
          roles?: string[];
        };
        accessToken: string;
      }>;
      createPayment: (
        paymentData: PiPaymentData,
        callbacks?: {
          onReadyForServerApproval?: (successCallback: () => void) => void;
          onCancel?: () => void;
          onIncompletePaymentFound?: (payment: PiPayment) => Promise<void>;
        }
      ) => Promise<PiPayment>;
      submitPayment: (paymentId: string) => Promise<PiPayment>;
      completePayment: (paymentId: string, txid: string) => Promise<PiPayment>;
      cancelPayment: (paymentId: string, reason?: string) => Promise<void>;
      getPayment: (paymentId: string) => Promise<PiPayment>;
      getUserWalletAddress: () => Promise<{ address: string }>;
    };
  }
}

export const initPiSDK = async (sandbox: boolean = false) => {
  // Handle edge runtime and SSR gracefully
  if (typeof window === 'undefined' || process.env.VERCEL_EDGE_RUNTIME) {
    return false;
  }

  // Wait for Pi object to be available
  let retries = 0;
  const maxRetries = 10;
  
  while (!window.Pi && retries < maxRetries) {
    await new Promise(resolve => setTimeout(resolve, 500));
    retries++;
  }

  if (!window.Pi) {
    console.warn('Pi SDK not available - ensure you are using Pi Browser');
    return false;
  }

  try {
    window.Pi.init({ 
      version: '2.0', 
      sandbox: process.env.NEXT_PUBLIC_PI_SANDBOX === 'true' || sandbox 
    });
    console.log('Pi SDK initialized in', process.env.NEXT_PUBLIC_PI_SANDBOX === 'true' ? 'sandbox' : 'production', 'mode');
    return true;
  } catch (error: any) {
    console.error('Failed to initialize Pi SDK:', error);
    return false; // Return false instead of throwing to handle errors gracefully
  }
};
