import { cn } from "@/lib/utils"

export function Loader({ className }: { className?: string }) {
  return (
    <div className="flex h-screen w-full items-center justify-center">
        <div className={cn("h-16 w-16 animate-spin rounded-full border-4 border-solid border-primary border-t-transparent", className)} />
    </div>
  )
}
