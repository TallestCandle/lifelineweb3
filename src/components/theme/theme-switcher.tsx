
"use client"

import * as React from "react"
import { Check } from "lucide-react"
import { useProfile } from "@/context/profile-provider"
import { themes, type ThemeId } from "@/context/theme-provider"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { useToast } from "@/hooks/use-toast"

export function ThemeSwitcher() {
  const { activeProfile, updateProfileTheme } = useProfile()
  const { toast } = useToast();

  const handleThemeChange = async (themeId: ThemeId) => {
    try {
      if (activeProfile?.theme === themeId) return;
      await updateProfileTheme(themeId);
      // The page will reload inside updateProfileTheme
    } catch (error) {
      console.error("Failed to update theme", error);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not save theme preference.' });
    }
  }

  return (
    <>
      {themes.map((item) => (
        <DropdownMenuItem
          key={item.id}
          onClick={() => handleThemeChange(item.id)}
          className="justify-between"
        >
          {item.name}
          {activeProfile?.theme === item.id && <Check className="h-4 w-4" />}
        </DropdownMenuItem>
      ))}
    </>
  )
}
