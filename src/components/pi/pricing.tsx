'use client';

import React from 'react';
import { usePayment } from '@/context/payment-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { PaymentHistory } from './payment-history';

interface PricingTier {
  name: string;
  price: number;
  description: string;
  features: string[];
}

const pricingTiers: PricingTier[] = [
  {
    name: 'Basic',
    price: 5,
    description: 'Essential health tracking features',
    features: [
      'Basic health monitoring',
      'Daily activity tracking',
      'Nutrition logging',
    ],
  },
  {
    name: 'Pro',
    price: 10,
    description: 'Advanced features for health enthusiasts',
    features: [
      'All Basic features',
      'AI-powered health insights',
      'Custom meal plans',
      'Priority support',
    ],
  },
  {
    name: 'Premium',
    price: 20,
    description: 'Complete health management solution',
    features: [
      'All Pro features',
      'Personal health coach AI',
      'Advanced analytics',
      'Custom workout plans',
      '24/7 support',
    ],
  },
];

export function PricingSection() {
  const { makePayment, processing } = usePayment();

  const handleSubscribe = async (tier: PricingTier) => {
    try {
      await makePayment(tier.price, `Subscription to ${tier.name} Plan`, {
        planType: tier.name,
        duration: '1 month',
      });
    } catch (error) {
      // Error is handled by the payment provider
      console.error('Payment failed:', error);
    }
  };

  return (
    <div className="container mx-auto py-12">
      <div className="text-center mb-10">
        <h2 className="text-3xl font-bold">Choose Your Plan</h2>
        <p className="text-gray-500 mt-2">Get access to powerful health tracking features</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        {pricingTiers.map((tier) => (
          <Card key={tier.name} className="flex flex-col">
            <CardHeader>
              <CardTitle>{tier.name}</CardTitle>
              <CardDescription>{tier.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow">
              <div className="text-3xl font-bold mb-6">{tier.price} π</div>
              <ul className="space-y-2">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-center">
                    <svg
                      className="w-5 h-5 text-green-500 mr-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <Button
                className="w-full"
                onClick={() => handleSubscribe(tier)}
                disabled={processing}
              >
                {processing ? "Processing..." : `Subscribe with ${tier.price} π`}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      <div className="mt-12">
        <h3 className="text-2xl font-bold mb-6">Transaction History</h3>
        <PaymentHistory />
      </div>
    </div>
  );
}
