
"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"

import { useProfile } from "@/context/profile-provider"
import { useTheme, type ThemeId } from "@/context/theme-provider"
import { useToast } from "@/hooks/use-toast"
import { Switch } from "@/components/ui/switch"

export function ThemeToggle() {
  const { activeProfile, updateProfileTheme } = useProfile()
  const { theme, setTheme } = useTheme()
  const { toast } = useToast()

  const handleThemeChange = async (checked: boolean) => {
    const newTheme: ThemeId = checked ? 'theme-serene-sky' : 'theme-cool-flash'
    
    // Immediately update the UI
    setTheme(newTheme) 
    
    try {
      // Persist the change in the background
      await updateProfileTheme(newTheme)
    } catch (error) {
      console.error("Failed to update theme", error)
      toast({ variant: 'destructive', title: 'Error', description: 'Could not save theme preference.' })
      // Revert UI change on error
      setTheme(theme)
    }
  }

  if (!activeProfile) {
    return null
  }

  return (
    <div className="flex items-center space-x-2">
      <Moon className="h-5 w-5" />
      <Switch
        id="theme-toggle"
        checked={theme === 'theme-serene-sky'}
        onCheckedChange={handleThemeChange}
        aria-label="Toggle theme"
      />
      <Sun className="h-5 w-5" />
    </div>
  )
}
