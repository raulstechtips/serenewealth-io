"use client"

import React, { useState } from "react"
import { Check, ChevronsUpDown, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { AddCategoryDialog } from "@/components/categories/add-category-dialog"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { Category } from "@/lib/types"

interface BulkCategoryEditorProps {
  categories?: Category[]
  selectedCategoryId: string | null | undefined
  onCategoryChange: (categoryId: string | null) => void
  onCategoryCreated?: (newCategory: Category) => void
  placeholder?: string
}

interface GroupedCategory extends Category {
  searchText: string
}

export function BulkCategoryEditor({ 
  categories: propCategories, 
  selectedCategoryId, 
  onCategoryChange, 
  onCategoryCreated, 
  placeholder = "Choose category..." 
}: BulkCategoryEditorProps) {
  const [open, setOpen] = useState(false)
  const [searchValue, setSearchValue] = useState("")
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  // Use categories from props - parent already ensures fresh data
  const categories = propCategories || []


  // Get current category info
  const getCurrentCategory = () => {
    if (selectedCategoryId === null) {
      return { name: 'Uncategorized', isUncategorized: true }
    }
    if (selectedCategoryId === undefined) {
      return { name: placeholder, isUncategorized: false }
    }
    const category = categories.find(c => c.id === selectedCategoryId)
    return { 
      name: category?.name || 'Unknown Category', 
      isUncategorized: false 
    }
  }

  const currentCategory = getCurrentCategory()

  // Group categories by their type and then by group name (like Monarch Money)
  const groupedCategories = React.useMemo(() => {
    // First, organize by type
    const categoryTypes: Record<string, Record<string, GroupedCategory[]>> = {
      INCOME: {},
      EXPENSE: {},
      TRANSFER: {}
    }
    
    categories.forEach(category => {
      const categoryType = category.type || 'EXPENSE'
      const groupName = category.group_name || category.group?.name || 'Other'
      
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
  }, [categories])

  // Filter categories based on search
  const filteredTypes = React.useMemo(() => {
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

  const handleCategorySelect = (categoryId: string | null) => {
    onCategoryChange(categoryId)
    setOpen(false)
  }

  const handleCategoryCreated = (newCategory: Category) => {
    // Notify parent about the new category (parent will refetch categories)
    onCategoryCreated?.(newCategory)
    
    // Apply the new category
    handleCategorySelect(newCategory.id)
  }


  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between h-10"
          >
            <span className={`text-sm truncate ${currentCategory.isUncategorized ? 'text-muted-foreground' : 'text-foreground'}`}>
              {currentCategory.name}
            </span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[320px] p-0"
          align="start"
          onWheelCapture={(e) => e.stopPropagation()}
        >
          <Command className="max-h-[400px]">
            <div className="flex items-center border-b px-3">
              <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
              <CommandInput 
                placeholder="Search categories..." 
                value={searchValue}
                onValueChange={setSearchValue}
                className="border-0 px-0 py-3 text-sm focus:ring-0"
              />
            </div>
            
            <div className="max-h-[300px] overflow-auto">
              <CommandEmpty className="py-6 text-center text-sm">No categories found.</CommandEmpty>
              
              {/* Uncategorized option */}
              <CommandGroup>
                <CommandItem
                  value="uncategorized"
                  onSelect={() => handleCategorySelect(null)}
                  className="cursor-pointer px-3 py-2"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      currentCategory.isUncategorized ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <Badge variant="destructive" className="text-xs">
                    Uncategorized
                  </Badge>
                </CommandItem>
              </CommandGroup>

              {/* Category types and groups */}
              {filteredTypes.map((categoryType) => (
                <div key={categoryType.type}>
                  {/* Type header (Income, Expense, Transfer) */}
                  <div className="px-3 py-2 text-xs font-semibold text-muted-foreground bg-muted/30 border-b">
                    {categoryType.displayName}
                  </div>
                  
                  {categoryType.groups.map((group) => (
                    <CommandGroup key={`${categoryType.type}-${group.name}`}>
                      {/* Group name within type */}
                      <div className="px-4 py-1.5 text-xs font-medium text-muted-foreground">
                        {group.name}
                      </div>
                      
                      {/* Categories within group */}
                      {group.categories.map((category) => (
                        <CommandItem
                          key={category.id}
                          value={category.searchText}
                          onSelect={() => handleCategorySelect(category.id)}
                          className="cursor-pointer px-6 py-2 hover:bg-muted/50"
                        >
                          <Check
                            className={cn(
                              "mr-3 h-4 w-4",
                              selectedCategoryId === category.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <span className="text-sm">{category.name}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  ))}
                </div>
              ))}
            </div>
            
            {/* Create new category option */}
            <div className="border-t">
              <CommandItem
                value="create-new-category"
                onSelect={() => setShowCreateDialog(true)}
                className="cursor-pointer px-3 py-3 text-primary"
              >
                <div className="flex items-center w-full">
                  <div className="mr-2 h-4 w-4 rounded-full border-2 border-primary flex items-center justify-center">
                    <div className="h-2 w-2 bg-primary rounded-full"></div>
                  </div>
                  <span className="text-sm font-medium">Create new category</span>
                </div>
              </CommandItem>
            </div>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Create Category Dialog */}
      <AddCategoryDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onCategoryCreated={handleCategoryCreated}
      />
    </>
  )
}
