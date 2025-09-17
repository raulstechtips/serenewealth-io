import { QueryClient } from "@tanstack/react-query"

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes - good default for most data
      gcTime: 10 * 60 * 1000, // 10 minutes - reasonable cleanup
      retry: 2, // Retry failed requests 2 times
      retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
    },
    mutations: {
      retry: 1, // Retry mutations once
    },
  },
})

// Enhanced Query keys with better typing
export const queryKeys = {
  // Reference data (cached aggressively)
  accounts: ["accounts"] as const,
  categories: ["categories"] as const,
  categoryGroups: ["category-groups"] as const,
  
  // Transactional data (not cached, infinite queries)
  transactions: (params?: { 
    accountId?: string
    accountIds?: string[]
    categoryId?: string
    categoryIds?: string[]
    dateFrom?: string
    dateTo?: string
    search?: string
    entryType?: string
    showUncategorized?: boolean
    showTransfers?: boolean
    showMatched?: boolean
    limit?: number
  }) => ["transactions", params] as const,
  
  // Dashboard and reports (shorter cache)
  recentTransactions: (days?: number) => ["recent-transactions", days] as const,
  transactionsSummary: ["transactions-summary"] as const,
  budget: (month: string) => ["budget", month] as const,
  
  // Account-specific data
  accountDetail: (id: string) => ["account", id] as const,
  accountTransactions: (id: string, params?: { 
    limit?: number
    includeRunningBalance?: boolean
    dateFrom?: string
    dateTo?: string
  }) => ["account-transactions", id, params] as const,
}
