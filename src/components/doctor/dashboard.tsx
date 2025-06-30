"use client";

import { useAuth } from "@/context/auth-provider";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../ui/card";
import { Users, BarChart, MessageSquare } from "lucide-react";
import Link from "next/link";

export function DoctorDashboard() {
  const { user } = useAuth();
  const doctorName = user?.displayName || user?.email?.split('@')[0] || "Doctor";

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-foreground/90">
          Welcome, Dr. {doctorName}.
        </h1>
        <p className="text-muted-foreground">Your command center for managing patient health.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link href="#">
          <Card className="cursor-pointer">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Users /> Patients</CardTitle>
              <CardDescription>View and manage your patient list.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">150</p>
              <p className="text-xs text-muted-foreground">+5 this week</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="#">
          <Card className="cursor-pointer">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><BarChart /> Analytics</CardTitle>
              <CardDescription>Review overall patient health trends.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">Health Trends</p>
              <p className="text-xs text-muted-foreground">Overall risk is stable.</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="#">
          <Card className="cursor-pointer">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><MessageSquare /> Messages</CardTitle>
              <CardDescription>Check your unread messages.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">8</p>
              <p className="text-xs text-muted-foreground">3 new messages today</p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
