// Pi Network SDK Types
export interface PiNetworkUser {
  username: string;     // Pi Username
  uid: string;         // User's unique identifier
  accessToken: string;  // OAuth access token
  roles?: string[];    // User roles in Pi Network
}

export interface PiUser {
  username: string;     // Pi Username
  uid: string;         // User's unique identifier
  accessToken: string;  // OAuth access token
  scopes: string[];    // Granted scopes
}

export interface UserData {
  username: string;
  uid: string;         // User's unique identifier
  createdAt: Date;
  updatedAt: Date;
  roles?: string[];
}

export interface AuthState {
  user: PiUser | null;
  userData: UserData | null;
  loading: boolean;
  error: Error | null;
}

export class PiAuthError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'PiAuthError';
  }
}
