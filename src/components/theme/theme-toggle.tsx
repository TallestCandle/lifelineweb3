
"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"

import { useProfile } from "@/context/profile-provider"
import type { ThemeId } from "@/context/theme-provider"
import { useToast } from "@/hooks/use-toast"
import { Switch } from "@/components/ui/switch"

export function ThemeToggle() {
  const { activeProfile, updateProfileTheme } = useProfile()
  const { toast } = useToast()

  const isLightTheme = activeProfile?.theme === 'theme-serene-sky'

  const handleThemeChange = async (checked: boolean) => {
    const newTheme: ThemeId = checked ? 'theme-serene-sky' : 'theme-cool-flash'
    if (activeProfile?.theme === newTheme) return

    try {
      await updateProfileTheme(newTheme)
      // Reload the page to apply the new theme globally
      window.location.reload()
    } catch (error) {
      console.error("Failed to update theme", error)
      toast({ variant: 'destructive', title: 'Error', description: 'Could not save theme preference.' })
    }
  }

  if (!activeProfile) {
    return null
  }

  return (
    <div className="flex items-center space-x-2">
      <Sun className="h-5 w-5" />
      <Switch
        id="theme-toggle"
        checked={isLightTheme}
        onCheckedChange={handleThemeChange}
        aria-label="Toggle theme"
      />
      <Moon className="h-5 w-5" />
    </div>
  )
}
