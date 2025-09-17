"use client"

import { useState } from "react"
import { ChevronsUpDown, Check, X, Building2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { Account } from "@/lib/types"

interface AccountFilterProps {
  value: string[]
  onChange: (value: string[]) => void
  accounts: Account[]
}

export function MultiAccountFilter({ value, onChange, accounts }: AccountFilterProps) {
  const [open, setOpen] = useState(false)
  
  const selectedAccounts = accounts.filter(account => value.includes(account.id))
  const hasValue = value.length > 0

  const toggleAccount = (accountId: string) => {
    if (value.includes(accountId)) {
      onChange(value.filter(id => id !== accountId))
    } else {
      onChange([...value, accountId])
    }
  }

  const clearFilter = () => {
    onChange([])
  }

  const getDisplayText = () => {
    if (hasValue) {
      if (selectedAccounts.length === 1) {
        return selectedAccounts[0].name
      }
      return `${selectedAccounts.length} accounts`
    }
    return "Accounts"
  }

  const removeAccount = (accountId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    onChange(value.filter(id => id !== accountId))
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "h-10 justify-between bg-background border-border/50 hover:bg-muted/50 transition-colors min-w-[160px] max-w-[280px]",
            hasValue && "border-primary/50 bg-primary/5"
          )}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <div className="flex items-center gap-1 min-w-0">
              {hasValue && selectedAccounts.length <= 2 ? (
                <div className="flex items-center gap-1 flex-wrap">
                  {selectedAccounts.map((account) => (
                    <Badge 
                      key={account.id} 
                      variant="secondary" 
                      className="text-xs max-w-[100px] truncate"
                    >
                      {account.name}
                      <div
                        onClick={(e) => removeAccount(account.id, e)}
                        className="ml-1 h-3 w-3 flex items-center justify-center hover:bg-muted rounded cursor-pointer"
                      >
                        <X className="h-2 w-2" />
                      </div>
                    </Badge>
                  ))}
                </div>
              ) : (
                <span className={cn(
                  "text-sm truncate",
                  hasValue ? "text-foreground font-medium" : "text-muted-foreground"
                )}>
                  {getDisplayText()}
                </span>
              )}
            </div>
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
            {hasValue && (
              <CommandItem
                value="clear-all"
                onSelect={clearFilter}
                className="text-muted-foreground"
              >
                <X className="mr-2 h-4 w-4" />
                Clear all selections
              </CommandItem>
            )}
            {accounts.map((account) => (
              <CommandItem
                key={account.id}
                value={account.name}
                onSelect={() => toggleAccount(account.id)}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    value.includes(account.id) ? "opacity-100" : "opacity-0"
                  )}
                />
                <div className="flex flex-col">
                  <span>{account.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {account.type}
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
