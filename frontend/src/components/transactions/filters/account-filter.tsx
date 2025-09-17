"use client"

import { useState } from "react"
import { ChevronsUpDown, Check, X, Building2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command"
import { cn } from "@/lib/utils"
import type { Account } from "@/lib/types"

interface AccountFilterProps {
  value: string
  onChange: (value: string) => void
  accounts: Account[]
}

export function AccountFilter({ value, onChange, accounts }: AccountFilterProps) {
  const [open, setOpen] = useState(false)
  
  const selectedAccount = accounts.find(account => account.id === value)
  const hasValue = value && value !== ""

  const clearFilter = () => {
    onChange("")
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "h-10 justify-between bg-background border-border/50 hover:bg-muted/50 transition-colors min-w-[160px]",
            hasValue && "border-primary/50 bg-primary/5"
          )}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span className={cn(
              "text-sm truncate",
              hasValue ? "text-foreground font-medium" : "text-muted-foreground"
            )}>
              {selectedAccount ? selectedAccount.name : "Account"}
            </span>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {hasValue && (
              <div
                onClick={(e) => {
                  e.stopPropagation()
                  clearFilter()
                }}
                className="h-5 w-5 flex items-center justify-center hover:bg-muted rounded cursor-pointer"
              >
                <X className="h-3 w-3" />
              </div>
            )}
            <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search accounts..." />
          <CommandEmpty>No accounts found.</CommandEmpty>
          <CommandGroup>
            <CommandItem
              value="all"
              onSelect={() => {
                onChange("")
                setOpen(false)
              }}
            >
              <Check
                className={cn(
                  "mr-2 h-4 w-4",
                  !hasValue ? "opacity-100" : "opacity-0"
                )}
              />
              All accounts
            </CommandItem>
            {accounts.map((account) => (
              <CommandItem
                key={account.id}
                value={account.name}
                onSelect={() => {
                  onChange(account.id)
                  setOpen(false)
                }}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    value === account.id ? "opacity-100" : "opacity-0"
                  )}
                />
                <div className="flex flex-col">
                  <span>{account.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {account.type} • {account.currency}
                  </span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
