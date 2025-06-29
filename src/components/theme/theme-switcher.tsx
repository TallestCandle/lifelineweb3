"use client"

import * as React from "react"
import { Check } from "lucide-react"
import { useTheme, themes } from "@/context/theme-provider"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme()

  return (
    <>
      {themes.map((item) => (
        <DropdownMenuItem
          key={item.id}
          onClick={() => setTheme(item.id)}
          className="justify-between"
        >
          {item.name}
          {theme === item.id && <Check className="h-4 w-4" />}
        </DropdownMenuItem>
      ))}
    </>
  )
}
