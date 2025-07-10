import { cn } from "@/lib/utils"

export function Loader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-background" {...props}>
      <div className={cn("flex items-center justify-center", className)}>
        <div className="relative h-16 w-48 overflow-hidden">
          <div className="absolute bottom-0 left-0 h-1/2 w-full bg-gradient-to-t from-primary/20 to-transparent" />
          <svg
            className="absolute bottom-0 left-0 -ml-4 h-16 w-[200%]"
            width="200%"
            height="64"
            viewBox="0 0 400 64"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M0 32 H100 L120 12 L140 52 L160 32 L180 32 L200 22 L220 42 L240 32 H400"
              stroke="hsl(var(--primary))"
              fill="none"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="animate-pulse-line"
            />
          </svg>
        </div>
      </div>
    </div>
  )
}
