export interface PiNetworkUser {
  username: string;
  uid: string;
  roles?: string[];
}

export interface PiNetworkAuthResult {
  user: PiNetworkUser;
  accessToken: string;
}

export interface PiNetwork {
  init: (options: { version: string; sandbox: boolean }) => void;
  authenticate: (
    scopes: string[],
    onIncompletePaymentFound?: (payment: any) => void
  ) => Promise<PiNetworkAuthResult>;
}

declare global {
  interface Window {
    Pi?: PiNetwork;
  }
}

export {};
