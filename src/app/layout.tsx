
import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster"
import { AuthProvider } from '@/context/auth-provider';
import { AuthGuard } from '@/components/auth/auth-guard';
import { Inter } from 'next/font/google';
import { SettingsProvider } from '@/context/settings-provider';
import { PaymentProvider } from '@/context/payment-provider';
import PiSDKSetup from '@/components/pi/pi-sdk-setup';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'Lifeline',
  description: 'Your Health, Empowered by AI.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} dark`} style={{ colorScheme: 'dark' }}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <PiSDKSetup />
      </head>
      <body>
        <SettingsProvider>
            <AuthProvider>
              <AuthGuard>
                <PaymentProvider>
                  {children}
                </PaymentProvider>
              </AuthGuard>
            </AuthProvider>
        </SettingsProvider>
        <Toaster />
      </body>
    </html>
  );
}
