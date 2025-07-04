
"use client";

import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useState, useEffect, Suspense } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Loader } from '@/components/ui/loader';
import { Stethoscope, UserCircle, ShieldX } from 'lucide-react';

interface DoctorProfileData {
  name: string;
  specialty: string;
}

function DoctorProfileViewer({ doctorId }: { doctorId: string }) {
  const [profile, setProfile] = useState<DoctorProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!doctorId) {
      setError("No doctor ID provided.");
      setLoading(false);
      return;
    }

    const fetchProfile = async () => {
      setLoading(true);
      try {
        const profileDocRef = doc(db, 'doctor_profiles', doctorId);
        const docSnap = await getDoc(profileDocRef);
        if (docSnap.exists()) {
          setProfile(docSnap.data() as DoctorProfileData);
        } else {
          setError("Doctor profile not found.");
        }
      } catch (err) {
        console.error("Error fetching doctor profile:", err);
        setError("Failed to load doctor profile.");
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [doctorId]);

  if (loading) {
    return <div className="flex justify-center items-center h-full"><Loader /></div>;
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <ShieldX className="w-16 h-16 mx-auto text-destructive"/>
            <CardTitle>Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  return (
    <div className="flex justify-center items-start pt-10 h-full">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center items-center">
          <UserCircle className="w-24 h-24 text-muted-foreground mb-4" />
          <CardTitle className="text-3xl">{profile.name}</CardTitle>
          <CardDescription className="flex items-center gap-2 text-lg">
            <Stethoscope className="w-5 h-5 text-primary"/>
            <span>{profile.specialty}</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground mt-4">
            {profile.name} is a verified healthcare professional on the Lifeline AI platform, dedicated to providing expert review and guidance for your health investigations.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function DoctorsPageContent() {
    const searchParams = useSearchParams();
    const doctorId = searchParams.get('id');

    if (doctorId) {
        return <DoctorProfileViewer doctorId={doctorId} />;
    }

    return (
        <div className="flex items-center justify-center h-full">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle>Feature Updated</CardTitle>
                </CardHeader>
                <CardContent className="text-center">
                    <p className="text-muted-foreground mb-4">
                        The AI Doctor Consultation has been upgraded to our new 24/7 Health Investigation service.
                    </p>
                    <Button asChild>
                        <Link href="/investigation">Start an Investigation</Link>
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}

export default function DeprecatedDoctorsPage() {
    return (
        <Suspense fallback={<Loader />}>
            <DoctorsPageContent />
        </Suspense>
    )
}
