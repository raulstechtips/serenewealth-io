"use client"

import React, { useState, useMemo } from "react"
import { ChevronsUpDown, Check, X, Tag } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { Category } from "@/lib/types"

interface GroupedCategory extends Category {
  searchText: string
}

interface CategoryFilterProps {
  value: string[]
  onChange: (value: string[]) => void
  categories: Category[]
}

export function MultiCategoryFilter({ value, onChange, categories }: CategoryFilterProps) {
  const [open, setOpen] = useState(false)
  const [searchValue, setSearchValue] = useState("")
  
  // Include all categories including transfers
  const filteredCategories = categories
  const selectedCategories = filteredCategories.filter(category => value.includes(category.id))
  const hasValue = value.length > 0

  // Group categories by type and then by group name (matching inline editor)
  const groupedCategories = useMemo(() => {
    // First, organize by type
    const categoryTypes: Record<string, Record<string, GroupedCategory[]>> = {
      INCOME: {},
      EXPENSE: {},
      TRANSFER: {}
    }
    
    filteredCategories.forEach(category => {
      const categoryType = category.type || 'EXPENSE'
      const groupName = category.group_name || 'Other'
      
      if (!categoryTypes[categoryType]) {
        categoryTypes[categoryType] = {}
      }
      
      if (!categoryTypes[categoryType][groupName]) {
        categoryTypes[categoryType][groupName] = []
      }
      
      categoryTypes[categoryType][groupName].push({
        ...category,
        searchText: `${category.name} ${groupName}`.toLowerCase()
      })
    })
    
    // Convert to structured format
    const result: { 
      type: string
      displayName: string
      groups: { name: string; categories: GroupedCategory[] }[]
    }[] = []
    
    // Order: Income, Expense, Transfer
    const typeOrder = [
      { key: 'INCOME', display: 'Income' },
      { key: 'EXPENSE', display: 'Expense' }, 
      { key: 'TRANSFER', display: 'Transfer' }
    ]
    
    typeOrder.forEach(({ key, display }) => {
      const typeGroups = categoryTypes[key] || {}
      const sortedGroups = Object.entries(typeGroups)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([groupName, cats]) => ({
          name: groupName,
          categories: cats.sort((a, b) => a.name.localeCompare(b.name))
        }))
      
      if (sortedGroups.length > 0) {
        result.push({
          type: key,
          displayName: display,
          groups: sortedGroups
        })
      }
    })
    
    return result
  }, [filteredCategories])

  // Filter categories based on search
  const filteredTypes = useMemo(() => {
    if (!searchValue) return groupedCategories
    
    const search = searchValue.toLowerCase()
    return groupedCategories.map(categoryType => ({
      ...categoryType,
      groups: categoryType.groups.map(group => ({
        ...group,
        categories: group.categories.filter(cat => cat.searchText.includes(search))
      })).filter(group => group.categories.length > 0)
    })).filter(categoryType => categoryType.groups.length > 0)
  }, [groupedCategories, searchValue])

  const toggleCategory = (categoryId: string) => {
    if (value.includes(categoryId)) {
      onChange(value.filter(id => id !== categoryId))
    } else {
      onChange([...value, categoryId])
    }
  }

  const clearFilter = () => {
    onChange([])
  }

  const getDisplayText = () => {
    if (hasValue) {
      if (selectedCategories.length === 1) {
        return selectedCategories[0].name
      }
      return `${selectedCategories.length} categories`
    }
    return "Categories"
  }

  const removeCategory = (categoryId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    onChange(value.filter(id => id !== categoryId))
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
            <Tag className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <div className="flex items-center gap-1 min-w-0">
              {hasValue && selectedCategories.length <= 2 ? (
                <div className="flex items-center gap-1 flex-wrap">
                  {selectedCategories.map((category) => (
                    <Badge 
                      key={category.id} 
                      variant="secondary" 
                      className="text-xs max-w-[100px] truncate"
                    >
                      {category.name}
                      <div
                        onClick={(e) => removeCategory(category.id, e)}
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
      <PopoverContent className="w-80 p-0" align="start">
        <Command>
          <CommandInput 
            placeholder="Search categories..." 
            value={searchValue}
            onValueChange={setSearchValue}
          />
          <CommandEmpty>No categories found.</CommandEmpty>
          
          <div className="max-h-[300px] overflow-auto">
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
            
            {filteredTypes.map((categoryType) => (
              <div key={categoryType.type}>
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50">
                  {categoryType.displayName}
                </div>
                {categoryType.groups.map((group) => (
                  <CommandGroup key={group.name} heading={group.name}>
                    {group.categories.map((category) => (
                      <CommandItem
                        key={category.id}
                        value={category.name}
                        onSelect={() => toggleCategory(category.id)}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            value.includes(category.id) ? "opacity-100" : "opacity-0"
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
              </div>
            ))}
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
