'use client';

import { PiPayment, PiPaymentData } from '@/types/pi-network';

export class PiPaymentService {
  private static instance: PiPaymentService;
  private constructor() {}

  static getInstance(): PiPaymentService {
    if (!PiPaymentService.instance) {
      PiPaymentService.instance = new PiPaymentService();
    }
    return PiPaymentService.instance;
  }

  private async ensurePaymentScope(): Promise<void> {
    if (!window.Pi) {
      throw new Error('Pi SDK not available');
    }

    try {
      // Re-authenticate to ensure we have the payments scope
      const auth = await window.Pi.authenticate(['username', 'payments', 'wallet_address']);
      
      if (!auth || !auth.user) {
        throw new Error('Authentication failed');
      }

      // Update the stored user data with new scopes
      const userData = {
        username: auth.user.username,
        uid: auth.user.uid,
        accessToken: auth.accessToken,
        scopes: ['username', 'payments', 'wallet_address']
      };

      localStorage.setItem('pi_user', JSON.stringify(userData));
      return;
    } catch (error) {
      console.error('Error ensuring payment scope:', error);
      throw new Error('Please grant payment permissions to continue.');
    }
  }

  async createPayment(data: PiPaymentData): Promise<PiPayment> {
    if (!window.Pi) {
      throw new Error('Pi SDK not available');
    }

    try {
      // Always ensure we have payment permissions
      await this.ensurePaymentScope();

      // Create a payment with all required callbacks
      const payment = await window.Pi.createPayment(
        {
          amount: data.amount,
          memo: data.memo,
          metadata: data.metadata,
        },
        {
          onReadyForServerApproval: (successCallback: () => void) => {
            console.log('Payment ready for server approval');
            // Call success callback immediately since we don't need server approval
            successCallback();
          },
          onIncompletePaymentFound: async (payment: PiPayment) => {
            console.log('Incomplete payment found', payment);
            // Handle any incomplete payments
            await this.handleIncompletePayment(payment);
          },
          onCancel: () => {
            console.log('Payment cancelled by user');
            throw new Error('Payment was cancelled by user');
          },
          onIncompletePaymentFound: async (payment: PiPayment) => {
            // Handle any incomplete payments
            await this.handleIncompletePayment(payment);
          },
          onCancel: () => {
            throw new Error('User cancelled the payment');
          }
        }
      );

      // Submit the payment to the Pi blockchain
      const submittedPayment = await window.Pi.submitPayment(payment.identifier);

      // Wait for the payment to be completed and verified
      const completedPayment = await this.waitForPaymentCompletion(submittedPayment.identifier);

      return completedPayment;
    } catch (error: any) {
      console.error('Payment error:', error);
      throw error;
    }
  }

  private async waitForPaymentCompletion(paymentId: string, maxAttempts: number = 30): Promise<PiPayment> {
    if (!window.Pi) {
      throw new Error('Pi SDK not available');
    }

    let attempts = 0;
    while (attempts < maxAttempts) {
      const payment = await window.Pi.getPayment(paymentId);
      
      if (payment.status.developer_completed && payment.status.transaction_verified) {
        return payment;
      }
      
      if (payment.status.cancelled || payment.status.user_cancelled) {
        throw new Error('Payment was cancelled');
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds between checks
      attempts++;
    }
    
    throw new Error('Payment verification timed out');
  }

  async handleIncompletePayment(payment: PiPayment): Promise<void> {
    if (!window.Pi) {
      throw new Error('Pi SDK not available');
    }

    try {
      if (!payment.status.transaction_verified) {
        // Payment needs to be verified
        await this.waitForPaymentCompletion(payment.identifier);
      }
      
      if (!payment.status.developer_completed) {
        // Complete the payment
        await window.Pi.completePayment(payment.identifier, payment.transaction.txid);
      }
    } catch (error) {
      console.error('Error handling incomplete payment:', error);
      throw error;
    }
  }

  async getUserWalletAddress(): Promise<string> {
    if (!window.Pi) {
      throw new Error('Pi SDK not available');
    }

    try {
      const { address } = await window.Pi.getUserWalletAddress();
      return address;
    } catch (error) {
      console.error('Error getting user wallet address:', error);
      throw error;
    }
  }
}
