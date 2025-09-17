import type { Account, LedgerEntry } from "@/lib/types"
import { 
  getAccountsList,
  getAccountDetail,
  getAccountFinancialSummary,
  getAccountHealth,
  getAccountActivity,
  getAccountDashboard,
  createAccount,
  updateAccount,
  deleteAccount,
  refreshAccountBalance,
  type CreateAccountRequest
} from "./accounts"
import { 
  getAccountTransactionsOptimized,
  getTransactions,
  getRecentTransactions,
  getTransactionsSummary,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  getFilteredTransactionIds,
  bulkUpdateTransactions,
  bulkReconcileTransactions
} from "./ledger"
import { 
  getCategoriesList,
  getCategoryDetail,
  getCategoriesGroupedByType,
  getCategoryUsageStats,
  getCategoryGroups,
  createCategory,
  updateCategory,
  deleteCategory
} from "./categories"

// Type for authenticated fetch function from useAuthenticatedFetch hook
export type AuthenticatedFetch = (url: string, options?: RequestInit) => Promise<Response>

export class APIError extends Error {
    constructor(public status: number, message: string) {
      super(message)
      this.name = 'APIError'
    }
  }
  
// Create optimized API client factory that takes authenticated fetch function
export const createOptimizedApiClient = (authenticatedFetch: AuthenticatedFetch) => ({
    // Account functions - optimized for performance
    
    // Fast list (uses AccountListSerializer)
    getAccountsList: () => getAccountsList(authenticatedFetch),
    
    // Basic account detail (uses AccountSerializer)
    getAccount: (id: string) => getAccountDetail(authenticatedFetch, id),
    
    // Rich financial data (specialized endpoints)
    getAccountFinancialSummary: (id: string) => getAccountFinancialSummary(authenticatedFetch, id),
    getAccountHealth: (id: string) => getAccountHealth(authenticatedFetch, id),
    getAccountActivity: (id: string, limit?: number) => getAccountActivity(authenticatedFetch, id, limit),
    
    // Complete dashboard in single call
    getAccountDashboard: (id: string) => getAccountDashboard(authenticatedFetch, id),
    
    // CRUD operations
    createAccount: (account: CreateAccountRequest) => createAccount(authenticatedFetch, account),
    updateAccount: (id: string, updates: Partial<Pick<Account, 'name' | 'type' | 'subtype' | 'currency'>>) => updateAccount(authenticatedFetch, id, updates),
    deleteAccount: (id: string) => deleteAccount(authenticatedFetch, id),
    
    // Balance management
    refreshAccountBalance: (id: string) => refreshAccountBalance(authenticatedFetch, id),
    
    // Transaction/Ledger functions - optimized for performance
    
    // Enhanced account transactions (with transfer context, running balances)
    getAccountTransactions: (accountId: string, params?: {
      limit?: number
      includeRunningBalance?: boolean
      dateFrom?: string
      dateTo?: string
    }) => getAccountTransactionsOptimized(authenticatedFetch, accountId, params),
    
    // General transactions with enhanced filtering
    getTransactions: (params?: {
      accountId?: string
      categoryId?: string
      dateFrom?: string
      dateTo?: string
      limit?: number
      month?: string
      entryType?: 'transfers'
    }) => getTransactions(authenticatedFetch, params),
    
    // Recent transactions across all accounts
    getRecentTransactions: (days?: number) => getRecentTransactions(authenticatedFetch, days),
    
    // Transaction analytics
    getTransactionsSummary: () => getTransactionsSummary(authenticatedFetch),
    
    // CRUD operations for transactions
    createTransaction: (transaction: {
      account: string
      effective_date: string
      description: string
      raw_amount: string
      category?: string
    }) => createTransaction(authenticatedFetch, transaction),
    updateTransaction: (id: string, updates: Partial<{
      effective_date: string
      description: string
      raw_amount: string
      category: string
    }>) => updateTransaction(authenticatedFetch, id, updates),
    deleteTransaction: (id: string) => deleteTransaction(authenticatedFetch, id),
    getFilteredTransactionIds: (filters: {
      limit?: number
      accountId?: string
      categoryId?: string
      dateFrom?: string
      dateTo?: string
      entryType?: string
    }) => getFilteredTransactionIds(authenticatedFetch, filters),
    
    bulkUpdateTransactions: (
      selection: {
        mode: 'individual' | 'all-filtered-except'
        entryIds?: string[]
        filters?: any
        excludedIds?: string[]
      }, 
      changes: { category?: string | null; reconciliation_status?: 'mark_cleared' | 'mark_uncleared' | null }
    ) => bulkUpdateTransactions(authenticatedFetch, selection, changes),
    
    bulkReconcileTransactions: (entryIds: string[], action: 'mark_cleared' | 'mark_uncleared') => 
      bulkReconcileTransactions(authenticatedFetch, entryIds, action),
    
    // Category functions
    getCategories: () => getCategoriesList(authenticatedFetch),
    getCategoriesList: () => getCategoriesList(authenticatedFetch),
    getCategoryGroups: () => getCategoryGroups(authenticatedFetch),
    getCategory: (id: string) => getCategoryDetail(authenticatedFetch, id),
    getCategoriesGroupedByType: () => getCategoriesGroupedByType(authenticatedFetch),
    getCategoryUsageStats: (id: string) => getCategoryUsageStats(authenticatedFetch, id),
    createCategory: (category: {
      name: string
      group_id: string
    }) => createCategory(authenticatedFetch, category),
    updateCategory: (id: string, updates: Partial<{
      name: string
      group_id: string
    }>) => updateCategory(authenticatedFetch, id, updates),
    deleteCategory: (id: string) => deleteCategory(authenticatedFetch, id),
    
    // Backward compatibility aliases
    getAccounts: () => getAccountsList(authenticatedFetch),
    getAccountDetail: (id: string) => getAccountDetail(authenticatedFetch, id),
  })

// Backward compatible client (can be used as drop-in replacement)
export const createApiClient = createOptimizedApiClient
