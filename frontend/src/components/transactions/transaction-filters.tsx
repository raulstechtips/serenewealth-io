"use client"

import { CalendarIcon, Search, Filter, X } from "lucide-react"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { LedgerEntry, Account, Category } from "@/lib/types"

interface TransactionFiltersProps {
  filters: {
    dateRange: { from?: Date; to?: Date }
    accountId: string
    categoryId: string
    search: string
    showUncategorized: boolean
    showTransfers: boolean
    showMatched: boolean
    limit: number
    entryType: "" | "transfers"
  }
  onFiltersChange: (filters: any) => void
  accounts: Account[]
  categories: Category[]
}

export function TransactionFilters({ filters, onFiltersChange, accounts, categories }: TransactionFiltersProps) {
  const updateFilter = (key: string, value: any) => {
    onFiltersChange({ ...filters, [key]: value })
  }

  const hasActiveFilters = () => {
    return (
      filters.search !== "" ||
      filters.accountId !== "" && filters.accountId !== "all" ||
      filters.categoryId !== "" && filters.categoryId !== "all" ||
      filters.dateRange.from ||
      filters.dateRange.to ||
      filters.showUncategorized ||
      !filters.showTransfers ||
      filters.showMatched ||  // Changed: now showing reconciled is considered "active"
      filters.entryType !== ""
    )
  }

  const clearAllFilters = () => {
    onFiltersChange({
      dateRange: { from: undefined, to: undefined },
      accountId: "all",
      categoryId: "all",
      search: "",
      showUncategorized: false,
      showTransfers: true,
      showMatched: false,
      limit: filters.limit,
      entryType: "",
    })
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filters
            {hasActiveFilters() && (
              <span className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded-full">
                Active
              </span>
            )}
          </CardTitle>
          {hasActiveFilters() && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllFilters}
              className="h-8 px-2 lg:px-3"
            >
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {/* Search */}
              <div className="space-y-2">
                <Label htmlFor="search">Search</Label>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="search"
                    placeholder="Search description..."
                    value={filters.search}
                    onChange={(e) => updateFilter("search", e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>

              {/* Account Filter */}
              <div className="space-y-2">
                <Label>Account</Label>
                <Select value={filters.accountId || "all"} onValueChange={(value) => updateFilter("accountId", value === "all" ? "" : value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All accounts" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All accounts</SelectItem>
                    {accounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Category Filter */}
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={filters.categoryId || "all"} onValueChange={(value) => updateFilter("categoryId", value === "all" ? "" : value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All categories</SelectItem>
                    {categories
                      .map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Date Range */}
              <div className="space-y-2">
                <Label>Date Range</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal bg-transparent">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {filters.dateRange.from ? (
                        filters.dateRange.to ? (
                          <>
                            {format(filters.dateRange.from, "LLL dd, y")} - {format(filters.dateRange.to, "LLL dd, y")}
                          </>
                        ) : (
                          format(filters.dateRange.from, "LLL dd, y")
                        )
                      ) : (
                        <span>Pick a date range</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      initialFocus
                      mode="range"
                      defaultMonth={filters.dateRange.from}
                      selected={filters.dateRange.from && filters.dateRange.to ? { from: filters.dateRange.from, to: filters.dateRange.to } : undefined}
                      onSelect={(range) => updateFilter("dateRange", range ?? { from: undefined, to: undefined })}
                      numberOfMonths={2}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Secondary filters */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {/* Entry Type Filter */}
              <div className="space-y-2">
                <Label>Entry Type</Label>
                <Select value={filters.entryType || "all"} onValueChange={(value) => updateFilter("entryType", value === "all" ? "" : value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All entries" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All entries</SelectItem>
                    <SelectItem value="transfers">Transfers only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Limit */}
              <div className="space-y-2">
                <Label>Show</Label>
                <Select value={filters.limit.toString()} onValueChange={(value) => updateFilter("limit", parseInt(value))}>
                  <SelectTrigger>
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

            {/* Checkboxes */}
            <div className="flex flex-wrap gap-6">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="uncategorized"
                  checked={filters.showUncategorized}
                  onCheckedChange={(checked) => updateFilter("showUncategorized", checked)}
                />
                <Label htmlFor="uncategorized" className="text-sm">
                  Show only uncategorized
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="transfers"
                  checked={filters.showTransfers}
                  onCheckedChange={(checked) => updateFilter("showTransfers", checked)}
                />
                <Label htmlFor="transfers" className="text-sm">
                  Include transfers
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="matched"
                  checked={filters.showMatched}
                  onCheckedChange={(checked) => updateFilter("showMatched", checked)}
                />
                <Label htmlFor="matched" className="text-sm">
                  Include reconciled
                </Label>
              </div>
            </div>
          </CardContent>
    </Card>
  )
}
