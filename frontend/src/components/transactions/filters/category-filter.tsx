"use client"

import { useState } from "react"
import { ChevronsUpDown, Check, X, Tag } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command"
import { cn } from "@/lib/utils"
import type { Category } from "@/lib/types"

interface CategoryFilterProps {
  value: string
  onChange: (value: string) => void
  categories: Category[]
}

export function CategoryFilter({ value, onChange, categories }: CategoryFilterProps) {
  const [open, setOpen] = useState(false)
  
  // Include all categories including transfers
  const filteredCategories = categories
  const selectedCategory = filteredCategories.find(category => category.id === value)
  const hasValue = value && value !== ""

  // Group categories by type for better organization
  const groupedCategories = filteredCategories.reduce((groups, category) => {
    const type = category.type || 'OTHER'
    if (!groups[type]) {
      groups[type] = []
    }
    groups[type].push(category)
    return groups
  }, {} as Record<string, Category[]>)

  const clearFilter = () => {
    onChange("")
  }

  const getCategoryTypeLabel = (type: string) => {
    switch (type) {
      case 'INCOME': return 'Income'
      case 'EXPENSE': return 'Expenses'
      case 'TRANSFER': return 'Transfers'
      default: return type
    }
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
            <Tag className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span className={cn(
              "text-sm truncate",
              hasValue ? "text-foreground font-medium" : "text-muted-foreground"
            )}>
              {selectedCategory ? selectedCategory.name : "Category"}
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
          <CommandInput placeholder="Search categories..." />
          <CommandEmpty>No categories found.</CommandEmpty>
          
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
            All categories
          </CommandItem>
          
          {Object.entries(groupedCategories).map(([type, typeCategories]) => (
            <CommandGroup key={type} heading={getCategoryTypeLabel(type)}>
              {typeCategories.map((category) => (
                <CommandItem
                  key={category.id}
                  value={category.name}
                  onSelect={() => {
                    onChange(category.id)
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === category.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex items-center gap-2">
                    {/* {category.icon && <span className="text-sm">{category.icon}</span>} */}
                    <span>{category.name}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </Command>
      </PopoverContent>
    </Popover>
  )
}
