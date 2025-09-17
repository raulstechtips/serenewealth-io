"use client"

import React, { useState, useEffect } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { TransactionsTable } from "@/components/transactions/transactions-table"
import { 
  SearchFilter, 
  DateFilter, 
  MultiAccountFilter, 
  MultiCategoryFilter, 
  AdvancedFilters 
} from "@/components/transactions/filters"
import { AddTransactionDialog } from "@/components/transactions/add-transaction-dialog"
import { AddTransferDialog } from "@/components/transactions/add-transfer-dialog"
import { useQuery } from "@tanstack/react-query"
import { createOptimizedApiClient } from "@/api/client"
import { useAuthenticatedFetch } from "@/contexts/auth-context"
import { useInfiniteTransactions } from "@/hooks/use-infinite-transactions"
import type { TransactionFilters } from "@/hooks/use-infinite-transactions"
import type { Account, Category } from "@/lib/types"

export default function TransactionsPage() {
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showTransferDialog, setShowTransferDialog] = useState(false)
  
  // API client
  const authenticatedFetch = useAuthenticatedFetch()
  const api = createOptimizedApiClient(authenticatedFetch)
  
  // Ref to hold the bulk edit reset function
  const bulkEditResetRef = React.useRef<(() => void) | null>(null)
  
  // Filter state - split into pending (UI state) and applied (query state)
  const [pendingFilters, setPendingFilters] = useState<TransactionFilters>({
    dateRange: { from: undefined, to: undefined },
    accountIds: [],
    categoryIds: [],
    search: "",
    showUncategorized: false,
    showTransfers: true,
    showMatched: false,
    limit: 50,
    entryType: "",
  })
  
  const [appliedFilters, setAppliedFilters] = useState<TransactionFilters>({
    dateRange: { from: undefined, to: undefined },
    accountIds: [],
    categoryIds: [],
    search: "",
    showUncategorized: false,
    showTransfers: true,
    showMatched: false,
    limit: 50,
    entryType: "",
  })

  // Direct API calls without aggressive caching
  const { data: accounts = [], isLoading: accountsLoading } = useQuery({
    queryKey: ['accounts'],
    queryFn: api.getAccountsList,
    staleTime: 0, // Always refetch
    refetchOnWindowFocus: false,
  })
  
  const { data: categories = [], isLoading: categoriesLoading, refetch: refetchCategories } = useQuery({
    queryKey: ['categories'],
    queryFn: api.getCategories,
    staleTime: 0, // Always refetch
    refetchOnWindowFocus: false,
  })
  
  // Use infinite transactions query with applied filters
  const {
    allTransactions,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: transactionsLoading,
    error,
    refetch,
    totalFilteredCount
  } = useInfiniteTransactions(appliedFilters)
  
  // Check if there are pending changes
  const hasUnappliedChanges = JSON.stringify(pendingFilters) !== JSON.stringify(appliedFilters)
  
  // Apply filters function
  const applyFilters = () => {
    // Reset bulk edit state before applying filters
    if (bulkEditResetRef.current) {
      bulkEditResetRef.current()
    }
    setAppliedFilters({ ...pendingFilters })
  }
  
  // Reset filters function
  const resetFilters = () => {
    // Reset bulk edit state before resetting filters
    if (bulkEditResetRef.current) {
      bulkEditResetRef.current()
    }
    const defaultFilters: TransactionFilters = {
      dateRange: { from: undefined, to: undefined },
      accountIds: [],
      categoryIds: [],
      search: "",
      showUncategorized: false,
      showTransfers: true,
      showMatched: false,
      limit: 50,
      entryType: "",
    }
    setPendingFilters(defaultFilters)
    setAppliedFilters(defaultFilters)
  }

  // Combined loading state
  const isLoading = accountsLoading || categoriesLoading || transactionsLoading

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-balance">Transactions</h1>
          <p className="text-muted-foreground text-sm md:text-base">Track and manage your financial transactions</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button onClick={() => setShowAddDialog(true)} className="w-full sm:w-auto">
            <Plus className="mr-2 h-4 w-4" />
            Add Transaction
          </Button>
          <Button onClick={() => setShowTransferDialog(true)} variant="secondary" className="w-full sm:w-auto">
            <Plus className="mr-2 h-4 w-4" />
            Add Transfer
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
          {error.message}
        </div>
      )}

      {/* Filter components with pending state and apply button */}
      <div className="space-y-4">
        <div className="flex flex-wrap gap-3 items-center">
          <SearchFilter
            value={pendingFilters.search}
            onChange={(value) => setPendingFilters(prev => ({ ...prev, search: value }))}
            placeholder="Search transactions..."
          />
          
          <DateFilter
            value={pendingFilters.dateRange}
            onChange={(value) => setPendingFilters(prev => ({ 
              ...prev, 
              dateRange: { 
                from: value.from || undefined, 
                to: value.to || undefined 
              } 
            }))}
          />
          
          <MultiAccountFilter
            value={pendingFilters.accountIds}
            onChange={(value) => setPendingFilters(prev => ({ ...prev, accountIds: value }))}
            accounts={accounts}
          />
          
          <MultiCategoryFilter
            value={pendingFilters.categoryIds}
            onChange={(value) => setPendingFilters(prev => ({ ...prev, categoryIds: value }))}
            categories={categories}
          />
          
          <AdvancedFilters
            filters={{
              showUncategorized: pendingFilters.showUncategorized,
              showTransfers: pendingFilters.showTransfers,
              showMatched: pendingFilters.showMatched,
              limit: pendingFilters.limit,
              entryType: pendingFilters.entryType,
            }}
            onChange={(key, value) => setPendingFilters(prev => ({ ...prev, [key]: value }))}
          />
        </div>
        
        {/* Apply/Reset filter buttons */}
        <div className="flex items-center gap-2">
          <Button 
            onClick={applyFilters}
            disabled={!hasUnappliedChanges}
            variant={hasUnappliedChanges ? "default" : "outline"}
          >
            Apply Filters
          </Button>
          
          <Button 
            onClick={resetFilters}
            variant="outline"
            disabled={JSON.stringify(pendingFilters) === JSON.stringify({
              dateRange: { from: undefined, to: undefined },
              accountIds: [],
              categoryIds: [],
              search: "",
              showUncategorized: false,
              showTransfers: true,
              showMatched: false,
              limit: 50,
              entryType: "",
            })}
          >
            Reset
          </Button>
          
          {hasUnappliedChanges && (
            <span className="text-sm text-muted-foreground">
              You have unapplied filter changes
            </span>
          )}
        </div>
      </div>

      <TransactionsTable
        transactions={allTransactions}
        accounts={accounts}
        categories={categories}
        isLoading={isLoading}
        onTransactionUpdated={refetch}
        // Infinite scroll props
        fetchNextPage={fetchNextPage}
        hasNextPage={hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
        // Bulk edit props
        currentFilters={appliedFilters}
        totalFilteredCount={totalFilteredCount}
        onBulkEditResetRef={(resetFn) => { bulkEditResetRef.current = resetFn }}
        // Category management
        onCategoryCreated={refetchCategories}
      />

      <AddTransactionDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        accounts={accounts}
        categories={categories}
        onTransactionCreated={refetch}
      />

      <AddTransferDialog
        open={showTransferDialog}
        onOpenChange={setShowTransferDialog}
        accounts={accounts}
        categories={categories}
        onTransferCreated={() => {
          refetch()
          // Refresh accounts balances & categories
          api.getAccountsList().then(() => {})
          refetchCategories()
        }}
      />

    </div>
  )
}
