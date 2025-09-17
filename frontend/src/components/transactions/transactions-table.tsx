"use client"

import React, { useState, useEffect } from "react"
import type { CheckedState } from "@radix-ui/react-checkbox"
import { MoreHorizontal, Edit, Trash2, ArrowUpRight, ArrowDownLeft, Check, Loader2 } from "lucide-react"
import { useInView } from "react-intersection-observer"
import { useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/hooks/use-toast"
import { InlineCategoryEditor } from "./inline-category-editor"
import { BulkEditSidebar } from "./bulk-edit-sidebar"
import { useBulkEdit } from "@/hooks/use-bulk-edit"
import type { LedgerEntry, Account, Category } from "@/lib/types"
import type { TransactionFilters } from "@/hooks/use-infinite-transactions"

interface TransactionsTableProps {
  transactions: LedgerEntry[]
  accounts: Account[]
  categories: Category[]
  isLoading: boolean
  onTransactionUpdated?: () => void
  // Infinite scroll props
  fetchNextPage?: () => void
  hasNextPage?: boolean
  isFetchingNextPage?: boolean
  // Bulk edit props
  currentFilters: TransactionFilters
  totalFilteredCount: number
  onBulkEditResetRef?: (resetFn: () => void) => void // New prop to expose bulk edit reset function
  // Category management
  onCategoryCreated?: () => void
}

export function TransactionsTable({ 
  transactions, 
  accounts, 
  categories, 
  isLoading, 
  onTransactionUpdated,
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage,
  currentFilters,
  totalFilteredCount,
  onBulkEditResetRef,
  onCategoryCreated
}: TransactionsTableProps) {
  const [localTransactions, setLocalTransactions] = useState<LedgerEntry[]>([])
  
  const { toast } = useToast()
  const queryClient = useQueryClient()
  
  
  // Bulk edit functionality
  const {
    bulkState,
    isLoading: bulkEditLoading,
    enterBulkMode,
    exitBulkMode,
    selectAll,
    clearSelection,
    toggleTransaction,
    setPendingChanges,
    applyChanges,
    selectAllState,
    isTransactionSelected,
    selectedCount,
    canApplyChanges
  } = useBulkEdit(currentFilters, totalFilteredCount)

  // Track if bulk edit sidebar should be open
  const [isBulkEditSidebarOpen, setIsBulkEditSidebarOpen] = React.useState(false)

  // Close sidebar when exiting bulk mode
  React.useEffect(() => {
    if (!bulkState.isActive) {
      setIsBulkEditSidebarOpen(false)
    }
  }, [bulkState.isActive])

  // Expose bulk edit reset function to parent
  React.useEffect(() => {
    if (onBulkEditResetRef) {
      onBulkEditResetRef(exitBulkMode)
    }
  }, [onBulkEditResetRef, exitBulkMode])

  // Infinite scroll trigger
  const { ref, inView } = useInView({
    threshold: 0,
    rootMargin: '100px', // Start loading 100px before hitting bottom
  })

  // Trigger fetch when scroll trigger is in view
  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage && fetchNextPage) {
      fetchNextPage()
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage])

  // Keep local state in sync with props
  React.useEffect(() => {
    setLocalTransactions(transactions)
  }, [transactions])

  // Handle category updates with optimistic updates
  const handleCategoryUpdated = (entryId: string, newCategory: Category | null) => {
    setLocalTransactions(prev => prev.map(transaction => {
      if (transaction.id !== entryId) return transaction
      
      return {
        ...transaction,
        category: newCategory?.id || undefined,
        category_name: newCategory?.name || undefined,
        category_type: newCategory?.type || undefined,
        category_group_name: newCategory?.group_name || undefined,
        effective_category: newCategory ? {
          type: 'direct' as const,
          category_id: newCategory.id,
          category_name: newCategory.name,
          category_type: newCategory.type,
          primary_category: null
        } : {
          type: 'uncategorized' as const,
          category_id: null,
          category_name: undefined,
          category_type: undefined,
          primary_category: null
        }
      }
    }))
  }

  // Handle new category creation
  const handleCategoryCreated = (newCategory: Category) => {
    // Trigger parent category refresh
    onCategoryCreated?.()
    // Also trigger a transaction refresh
    onTransactionUpdated?.()
  }

  // Group transactions by date but keep them in a seamless table structure
  const groupedTransactions = React.useMemo(() => {
    const groups: Record<string, LedgerEntry[]> = {}
    
    localTransactions.forEach(transaction => {
      const date = transaction.effective_date
      if (!groups[date]) {
        groups[date] = []
      }
      groups[date].push(transaction)
    })
    
    // Sort dates descending – the ISO yyyy-mm-dd format can be ordered lexicographically
    const sortedDates = Object.keys(groups).sort((a, b) => b.localeCompare(a))
    
    // Flatten into a single array with date headers
    const flattenedTransactions: (LedgerEntry | { type: 'date-header', date: string, total: number })[] = []
    
    sortedDates.forEach(date => {
      const dayTransactions = groups[date].sort((a, b) => b.id.localeCompare(a.id))
      const dayTotal = dayTransactions.reduce((sum, t) => sum + parseFloat(t.raw_amount), 0)
      
      // Add date header
      flattenedTransactions.push({ type: 'date-header', date, total: dayTotal })
      
      // Add transactions for this date
      flattenedTransactions.push(...dayTransactions)
    })
    
    return flattenedTransactions
  }, [localTransactions])

  const formatCurrency = (amount: string | number) => {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(Math.abs(numAmount))
  }

  // Parse an ISO yyyy-mm-dd string as a LOCAL date, not UTC, to avoid timezone shifts
  const formatDate = (dateString: string) => {
    const [year, month, day] = dateString.split("-").map(Number)
    const date = new Date(year, month - 1, day) // month is 0-based
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  const getAccountName = (accountId: string) => {
    return accounts.find((a) => a.id === accountId)?.name || "Unknown Account"
  }

  const getCategoryInfo = (entry: LedgerEntry) => {
    // Use effective_category if available, otherwise fall back to category lookup
    if (entry.effective_category) {
      switch (entry.effective_category.type) {
        case 'direct':
          return {
            name: entry.effective_category.category_name || 'Unknown',
            type: entry.effective_category.category_type,
            isUncategorized: false,
          }
        case 'uncategorized':
          return {
            name: 'Uncategorized',
            type: null,
            isUncategorized: true,
          }
      }
    }

    // Legacy fallback
    if (entry.category_name) {
      return {
        name: entry.category_name,
        type: entry.category_type,
        isUncategorized: false,
      }
    }

    return {
      name: 'Uncategorized',
      type: null,
      isUncategorized: true,
    }
  }




  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="flex items-center space-x-4">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-[200px]" />
                  <Skeleton className="h-4 w-[100px]" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Transactions</CardTitle>
          
          {!bulkState.isActive ? (
            // Default state - show "Edit Multiple" button
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={enterBulkMode}
                disabled={localTransactions.length === 0}
              >
                Edit Multiple
              </Button>
            </div>
          ) : (
            // Bulk edit mode - show Cancel and Edit with count
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {selectedCount} selected
                {bulkState.mode === 'all-filtered-except' && totalFilteredCount > 0 && 
                  ` (all ${totalFilteredCount} filtered)`
                }
              </span>
              
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={exitBulkMode}
              >
                Cancel
              </Button>
              
              <Button 
                variant={selectedCount > 0 ? "default" : "outline"}
                size="sm" 
                onClick={() => selectedCount > 0 && setIsBulkEditSidebarOpen(true)}
                disabled={selectedCount === 0}
                className={selectedCount === 0 ? "text-muted-foreground" : ""}
              >
                {selectedCount === 0 
                  ? "Edit 0" 
                  : `Edit ${selectedCount.toLocaleString()}`
                }
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {groupedTransactions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No transactions found.
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    {bulkState.isActive && (
                      <TableHead className="w-[50px]">
                        <Checkbox
                          checked={selectAllState as CheckedState}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              selectAll()
                            } else {
                              clearSelection()
                            }
                          }}
                          aria-label="Select all transactions"
                        />
                      </TableHead>
                    )}
                    <TableHead>Description</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groupedTransactions.map((item, index) => {
                    if ('type' in item && item.type === 'date-header') {
                      // Date header row
                      const isPositiveDay = item.total > 0
                      return (
                        <TableRow key={`date-${item.date}`} className="bg-muted/30 hover:bg-muted/30">
                          <TableCell 
                            colSpan={bulkState.isActive ? 6 : 5}
                            className="py-3"
                          >
                            <div className="flex items-center justify-between">
                              <h3 className="text-sm font-medium text-muted-foreground">
                                {formatDate(item.date)}
                              </h3>
                              <div className={`text-sm font-medium ${isPositiveDay ? 'text-green-600' : item.total < 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                                {item.total !== 0 && (
                                  <>
                                    {isPositiveDay ? '+' : ''}
                                    {formatCurrency(item.total)}
                                  </>
                                )}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    } else {
                      // Regular transaction row
                      const transaction = item as LedgerEntry
                      return (
                        <TableRow 
                          key={transaction.id} 
                          data-state={
                            bulkState.isActive && isTransactionSelected(transaction.id) ? "selected" : undefined
                          }
                        >
                          {bulkState.isActive && (
                            <TableCell>
                              <Checkbox
                                checked={isTransactionSelected(transaction.id)}
                                onCheckedChange={(checked) => {
                                  toggleTransaction(transaction.id, !!checked)
                                }}
                                aria-label="Select transaction"
                              />
                            </TableCell>
                          )}
                          <TableCell>
                            <div className="space-y-1">
                              <div className="font-medium">{transaction.description || "No description"}</div>
                              {transaction.is_transfer && transaction.other_account_name && (
                                <div className="text-sm text-muted-foreground">
                                  {transaction.transfer_direction === 'outgoing' ? 'To: ' : 'From: '}
                                  {transaction.other_account_name}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <InlineCategoryEditor
                              entry={transaction}
                              categories={categories}
                              onCategoryUpdated={handleCategoryUpdated}
                              onCategoryCreated={handleCategoryCreated}
                            />
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="link"
                              className="h-auto p-0 text-left font-normal text-primary hover:underline"
                              onClick={() => {
                                window.location.href = '/accounts'
                              }}
                            >
                              {transaction.account_name || getAccountName(transaction.account)}
                            </Button>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              {(() => {
                                const rawAmount = parseFloat(transaction.raw_amount)
                                const isPositive = rawAmount > 0
                                return (
                                  <>
                                    <div
                                      className={`p-1 rounded-full ${isPositive ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"}`}
                                    >
                                      {isPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownLeft className="h-3 w-3" />}
                                    </div>
                                    <div className={`font-medium ${isPositive ? "text-green-600" : "text-red-600"}`}>
                                      {isPositive ? "+" : "-"}
                                      {formatCurrency(rawAmount)}
                                    </div>
                                  </>
                                )
                              })()}
                            </div>
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                  <span className="sr-only">Open menu</span>
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => console.log('Edit entry:', transaction.id)}>
                                  <Edit className="mr-2 h-4 w-4" />
                                  Edit Entry
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => console.log('Delete entry:', transaction.id)} className="text-destructive">
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete Entry
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      )
                    }
                  })}
                </TableBody>
              </Table>
            </div>
          )}
          
          {/* Infinite scroll trigger and loading state */}
          <div ref={ref} className="h-20 flex items-center justify-center">
            {isFetchingNextPage && (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">Loading more transactions...</span>
              </div>
            )}
            {!hasNextPage && localTransactions.length > 0 && (
              <span className="text-sm text-muted-foreground">No more transactions to load</span>
            )}
            {!hasNextPage && localTransactions.length === 0 && !isLoading && (
              <span className="text-sm text-muted-foreground">No transactions found</span>
            )}
          </div>

          {/* Summary Info */}
          {localTransactions.length > 0 && (
            <div className="flex items-center justify-between pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                Showing {localTransactions.length} transactions
                {hasNextPage && (
                  <span className="ml-2 text-xs bg-muted px-2 py-1 rounded">
                    Scroll down to load more
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </CardContent>

      {/* Bulk Edit Sidebar */}
      <BulkEditSidebar
        isOpen={isBulkEditSidebarOpen}
        onClose={() => setIsBulkEditSidebarOpen(false)}
        selectedCount={selectedCount}
        totalFilteredCount={totalFilteredCount}
        isSelectingAll={bulkState.mode === 'all-filtered-except'}
        categories={categories}
        onCategoryChange={(categoryId) => setPendingChanges({ category: categoryId })}
        onReconciliationChange={(status) => setPendingChanges({ reconciliation_status: status })}
        onApplyChanges={applyChanges}
        isLoading={bulkEditLoading}
        pendingChanges={bulkState.pendingChanges}
        onCategoryCreated={handleCategoryCreated}
      />
    </Card>
  )
}
