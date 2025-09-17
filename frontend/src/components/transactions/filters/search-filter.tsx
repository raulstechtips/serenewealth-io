"use client"

import { Search, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

interface SearchFilterProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export function SearchFilter({ value, onChange, placeholder = "Search transactions..." }: SearchFilterProps) {
  const hasValue = value.length > 0

  return (
    <div className="relative flex-1 min-w-[200px]">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pl-9 pr-9 h-10 border-border/50 focus-visible:border-primary/50 transition-colors"
      />
      {hasValue && (
        <div
          onClick={() => onChange("")}
          className="absolute right-1 top-1/2 h-7 w-7 flex items-center justify-center -translate-y-1/2 hover:bg-muted/50 rounded cursor-pointer"
        >
          <X className="h-3 w-3" />
        </div>
      )}
    </div>
  )
}
