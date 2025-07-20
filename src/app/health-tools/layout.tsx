
"use client";
import { AppShell } from "@/components/app-shell";

export default function HealthToolsLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <AppShell>{children}</AppShell>;
}
