
"use client";

import React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Star, Video, Phone, MessageSquare } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAuth } from '@/context/auth-provider';

const doctors = [
  {
    name: 'Dr. Amina Okoro',
    specialty: 'Cardiologist',
    rating: 4.9,
    reviews: 124,
    image: 'https://placehold.co/100x100.png',
    dataAiHint: 'woman doctor',
    availability: ['Video Call', 'Audio Call'],
  },
  {
    name: 'Dr. Ben Carter',
    specialty: 'General Physician',
    rating: 4.8,
    reviews: 210,
    image: 'https://placehold.co/100x100.png',
    dataAiHint: 'man doctor',
    availability: ['Video Call', 'Audio Call', 'Chat'],
  },
  {
    name: 'Dr. Chidinma Eze',
    specialty: 'Endocrinologist',
    rating: 5.0,
    reviews: 98,
    image: 'https://placehold.co/100x100.png',
    dataAiHint: 'woman doctor smiling',
    availability: ['Video Call'],
  },
  {
    name: 'Dr. Tunde Adebayo',
    specialty: 'Pediatrician',
    rating: 4.7,
    reviews: 150,
    image: 'https://placehold.co/100x100.png',
    dataAiHint: 'man doctor portrait',
    availability: ['Audio Call', 'Chat'],
  },
];

const AvailabilityIcons: Record<string, React.ElementType> = {
  'Video Call': Video,
  'Audio Call': Phone,
  'Chat': MessageSquare,
};

export function DoctorBooking() {
  const { user } = useAuth();
  const router = useRouter();

  const handleBooking = (doctorName: string) => {
    const channelName = doctorName.replace(/\s+/g, '-').toLowerCase();
    router.push(`/call/${channelName}`);
  };

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Consult a Doctor</CardTitle>
          <CardDescription>Book a secure, high-quality audio or video call with a licensed professional powered by Agora.</CardDescription>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {doctors.map((doctor, index) => (
          <Card key={index} className="flex flex-col">
            <CardHeader className="flex-row items-center gap-4">
              <Avatar className="w-16 h-16 border-2 border-primary">
                <AvatarImage src={doctor.image} alt={doctor.name} data-ai-hint={doctor.dataAiHint} />
                <AvatarFallback>{doctor.name.charAt(0)}</AvatarFallback>
              </Avatar>
              <div>
                <CardTitle className="text-xl">{doctor.name}</CardTitle>
                <CardDescription>{doctor.specialty}</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="flex-grow space-y-4">
              <div className="flex items-center gap-2">
                <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                <span className="font-bold">{doctor.rating.toFixed(1)}</span>
                <span className="text-sm text-muted-foreground">({doctor.reviews} reviews)</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {doctor.availability.map((type) => {
                  const Icon = AvailabilityIcons[type];
                  return (
                    <Badge key={type} variant="secondary" className="flex items-center gap-1.5">
                      {Icon && <Icon className="w-3.5 h-3.5" />}
                      {type}
                    </Badge>
                  );
                })}
              </div>
            </CardContent>
            <CardFooter>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button className="w-full">Book Now</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Start In-App Call</AlertDialogTitle>
                    <AlertDialogDescription>
                      You are about to start a secure video call with {doctor.name}. Please ensure you have given browser permissions for your camera and microphone.
                      <br /><br />
                      This call will be for user: <strong>{user?.displayName}</strong>.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleBooking(doctor.name)}>
                      Proceed to Call
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
