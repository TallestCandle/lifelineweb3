
"use client";

import { cn } from "@/lib/utils";
import { useState, useEffect } from 'react';

export function Loader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  return (
    <div className="flex h-screen w-full items-center justify-center bg-background" {...props}>
      <div className={cn("relative flex h-20 w-20 items-center justify-center", className)}>
        {isMounted && (
          <>
            <div className="absolute h-full w-full animate-pulse-ring rounded-full border-2 border-primary/50" style={{ animationDelay: '0s' }} />
            <div className="absolute h-full w-full animate-pulse-ring rounded-full border-2 border-primary/50" style={{ animationDelay: '0.5s' }} />
            <div className="absolute h-full w-full animate-pulse-ring rounded-full border-2 border-primary/50" style={{ animationDelay: '1s' }} />
            <div className="h-4 w-4 animate-pulse-dot rounded-full bg-primary shadow-lg shadow-primary/50" />
          </>
        )}
      </div>
    </div>
  );
}
