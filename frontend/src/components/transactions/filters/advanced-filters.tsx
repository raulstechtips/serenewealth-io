"use client"

import { useState } from "react"
import { Settings2, ChevronDown, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

interface AdvancedFiltersProps {
  filters: {
    showUncategorized: boolean
    showTransfers: boolean
    showMatched: boolean
    limit: number
    entryType: "" | "transfers"
  }
  onChange: (key: string, value: any) => void
}

export function AdvancedFilters({ filters, onChange }: AdvancedFiltersProps) {
  const [open, setOpen] = useState(false)
  
  const hasActiveFilters = () => {
    return (
      filters.showUncategorized ||
      !filters.showTransfers ||
      filters.showMatched ||
      filters.entryType !== "" ||
      filters.limit !== 50
    )
  }

  const clearAdvancedFilters = () => {
    onChange("showUncategorized", false)
    onChange("showTransfers", true)
    onChange("showMatched", false)
    onChange("entryType", "")
    onChange("limit", 50)
  }

  const getFilterSummary = () => {
    const active = []
    if (filters.showUncategorized) active.push("Uncategorized")
    if (!filters.showTransfers) active.push("No transfers")
    if (filters.showMatched) active.push("Reconciled")
    if (filters.entryType === "transfers") active.push("Transfers only")
    if (filters.limit !== 50) active.push(`${filters.limit} results`)
    
    return active.length > 0 ? active.join(", ") : "More filters"
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "h-10 justify-between bg-background border-border/50 hover:bg-muted/50 transition-colors",
            hasActiveFilters() && "border-primary/50 bg-primary/5"
          )}
        >
          <div className="flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-muted-foreground" />
            <span className={cn(
              "text-sm max-w-[120px] truncate",
              hasActiveFilters() ? "text-foreground font-medium" : "text-muted-foreground"
            )}>
              {getFilterSummary()}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {hasActiveFilters() && (
              <div
                onClick={(e) => {
                  e.stopPropagation()
                  clearAdvancedFilters()
                }}
                className="h-5 w-5 flex items-center justify-center hover:bg-muted rounded cursor-pointer"
              >
                <X className="h-3 w-3" />
              </div>
            )}
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-sm">Advanced Filters</h4>
            {hasActiveFilters() && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAdvancedFilters}
                className="h-8 px-2 text-xs"
              >
                Clear all
              </Button>
            )}
          </div>

          <Separator />

          {/* Toggle switches */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="uncategorized" className="text-sm font-normal">
                Show only uncategorized
              </Label>
              <Switch
                id="uncategorized"
                checked={filters.showUncategorized}
                onCheckedChange={(checked) => onChange("showUncategorized", checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="transfers" className="text-sm font-normal">
                Include transfers
              </Label>
              <Switch
                id="transfers"
                checked={filters.showTransfers}
                onCheckedChange={(checked) => onChange("showTransfers", checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="matched" className="text-sm font-normal">
                Include reconciled
              </Label>
              <Switch
                id="matched"
                checked={filters.showMatched}
                onCheckedChange={(checked) => onChange("showMatched", checked)}
              />
            </div>
          </div>

          <Separator />

          {/* Entry type filter */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Entry Type</Label>
            <Select 
              value={filters.entryType || "all"} 
              onValueChange={(value) => onChange("entryType", value === "all" ? "" : value)}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All entries</SelectItem>
                <SelectItem value="transfers">Transfers only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Results limit */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Results per page</Label>
            <Select 
              value={filters.limit.toString()} 
              onValueChange={(value) => onChange("limit", parseInt(value))}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="25">25 transactions</SelectItem>
                <SelectItem value="50">50 transactions</SelectItem>
                <SelectItem value="100">100 transactions</SelectItem>
                <SelectItem value="200">200 transactions</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
