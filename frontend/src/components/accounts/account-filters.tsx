"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { X, Filter, Search } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { AccountType, AccountSubtype } from "@/lib/types"

interface AccountFilters {
  search: string
  type: AccountType | "all"
  subtype: AccountSubtype | "all"
}

interface AccountFiltersProps {
  filters: AccountFilters
  onFiltersChange: (filters: AccountFilters) => void
}

export function AccountFilters({ filters, onFiltersChange }: AccountFiltersProps) {
  const [isOpen, setIsOpen] = useState(false)

  const updateFilter = (key: keyof AccountFilters, value: string) => {
    const newFilters = { ...filters, [key]: value }
    
    // If type changes, reset subtype if it's not available for the new type
    if (key === "type") {
      const availableSubtypes = getAvailableSubtypesForType(value as AccountType | "all")
      const currentSubtype = filters.subtype
      if (currentSubtype !== "all" && !availableSubtypes.some(st => st.value === currentSubtype)) {
        newFilters.subtype = "all"
      }
    }
    
    onFiltersChange(newFilters)
  }
  
  // Helper function to get subtypes for a specific type (used in updateFilter)
  const getAvailableSubtypesForType = (type: AccountType | "all") => {
    if (type === "ASSET") {
      return [
        { value: "CHECKING", label: "Checking" },
        { value: "SAVINGS", label: "Savings" },
        { value: "INVESTMENT", label: "Investment" },
      ]
    } else if (type === "LIABILITY") {
      return [
        { value: "CREDIT", label: "Credit" },
        { value: "LOAN", label: "Loan" },
      ]
    } else {
      return [
        { value: "CHECKING", label: "Checking" },
        { value: "SAVINGS", label: "Savings" },
        { value: "INVESTMENT", label: "Investment" },
        { value: "CREDIT", label: "Credit" },
        { value: "LOAN", label: "Loan" },
      ]
    }
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "ASSET": return "Assets"
      case "LIABILITY": return "Liabilities"
      default: return type
    }
  }

  const getSubtypeLabel = (subtype: string) => {
    switch (subtype) {
      case "CHECKING": return "Checking"
      case "SAVINGS": return "Savings"
      case "CREDIT": return "Credit"
      case "LOAN": return "Loan"
      case "INVESTMENT": return "Investment"
      default: return subtype
    }
  }

  // Get available subtypes based on selected account type
  const getAvailableSubtypes = () => {
    return getAvailableSubtypesForType(filters.type)
  }

  const clearFilters = () => {
    onFiltersChange({
      search: "",
      type: "all",
      subtype: "all",
    })
  }

  const activeFiltersCount = Object.entries(filters).filter(([key, value]) => {
    if (key === "search") return value.length > 0
    return value !== "all"
  }).length

  return (
    <div className="flex flex-col sm:flex-row gap-3 mb-6">
      {/* Search Input */}
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
        <Input
          placeholder="Search accounts..."
          value={filters.search}
          onChange={(e) => updateFilter("search", e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Filter Popover */}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="relative bg-transparent">
            <Filter className="h-4 w-4 mr-2" />
            Filters
            {activeFiltersCount > 0 && (
              <Badge variant="secondary" className="ml-2 h-5 w-5 p-0 text-xs">
                {activeFiltersCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-4" align="end">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Filter Accounts</h4>
              {activeFiltersCount > 0 && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="h-auto p-1 text-xs">
                  Clear all
                </Button>
              )}
            </div>

            <div className="space-y-3">
              <div>
                <Label className="text-sm font-medium">Account Type</Label>
                <Select value={filters.type} onValueChange={(value) => updateFilter("type", value)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="ASSET">Assets</SelectItem>
                    <SelectItem value="LIABILITY">Liabilities</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm font-medium">Account Subtype</Label>
                <Select value={filters.subtype} onValueChange={(value) => updateFilter("subtype", value)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Subtypes</SelectItem>
                    {getAvailableSubtypes().map((subtype) => (
                      <SelectItem key={subtype.value} value={subtype.value}>
                        {subtype.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Active Filters */}
      {activeFiltersCount > 0 && (
        <div className="flex flex-wrap gap-2">
          {filters.search && (
            <Badge variant="secondary" className="gap-1">
              Search: {filters.search}
              <button
                type="button"
                className="ml-1 inline-flex items-center justify-center"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  updateFilter("search", "")
                }}
              >
                <X className="h-3 w-3 cursor-pointer hover:bg-red-100 hover:text-red-600 rounded-sm p-0.5 -m-0.5 transition-colors" />
              </button>
            </Badge>
          )}
          {filters.type !== "all" && (
            <Badge variant="secondary" className="gap-1">
              Type: {getTypeLabel(filters.type)}
              <button
                type="button"
                className="ml-1 inline-flex items-center justify-center"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  updateFilter("type", "all")
                }}
              >
                <X className="h-3 w-3 cursor-pointer hover:bg-red-100 hover:text-red-600 rounded-sm p-0.5 -m-0.5 transition-colors" />
              </button>
            </Badge>
          )}
          {filters.subtype !== "all" && (
            <Badge variant="secondary" className="gap-1">
              Subtype: {getSubtypeLabel(filters.subtype)}
              <button
                type="button"
                className="ml-1 inline-flex items-center justify-center"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  updateFilter("subtype", "all")
                }}
              >
                <X className="h-3 w-3 cursor-pointer hover:bg-red-100 hover:text-red-600 rounded-sm p-0.5 -m-0.5 transition-colors" />
              </button>
            </Badge>
          )}
        </div>
      )}
    </div>
  )
}
