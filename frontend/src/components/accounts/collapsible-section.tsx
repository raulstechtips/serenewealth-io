"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useLocalStorage } from "@/hooks/use-local-storage"

interface CollapsibleSectionProps {
  title: string
  subtitle?: string
  count: number
  totalBalance?: number
  defaultOpen?: boolean
  storageKey?: string // Unique key for localStorage persistence
  children: React.ReactNode
}

export function CollapsibleSection({
  title,
  subtitle,
  count,
  totalBalance,
  defaultOpen = true,
  storageKey,
  children,
}: CollapsibleSectionProps) {
  // Always use localStorage hook, but with different keys
  const storageKeyToUse = storageKey ? `accounts-section-${storageKey}` : `temp-section-${title.toLowerCase().replace(/\s+/g, '-')}`
  const [isOpen, setIsOpen] = useLocalStorage(storageKeyToUse, defaultOpen)

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount)
  }

  return (
    <div className="space-y-3">
      <Button
        variant="ghost"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full justify-between p-3 h-auto hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            {isOpen ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
            <h2 className="text-lg font-semibold">{title}</h2>
          </div>
          <Badge variant="secondary" className="text-xs">
            {count} {count === 1 ? "account" : "accounts"}
          </Badge>
        </div>
        
        <div className="flex flex-col items-end gap-1">
          {totalBalance !== undefined && (
            <div className="text-sm font-medium text-muted-foreground">
              Total: {formatCurrency(totalBalance)}
            </div>
          )}
          {subtitle && (
            <div className="text-xs text-muted-foreground">
              {subtitle}
            </div>
          )}
        </div>
      </Button>
      
      {isOpen && (
        <div className="space-y-3 pl-6 animate-in slide-in-from-top-2 duration-200">
          {children}
        </div>
      )}
    </div>
  )
}
