import type { LedgerEntry } from '@/lib/types'
import type { AuthenticatedFetch } from "@/api/client"
import { APIError } from "@/api/client"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

// Optimized Ledger/Transaction API functions

export async function getAccountTransactionsOptimized(
  authenticatedFetch: AuthenticatedFetch,
  accountId: string,
  params: {
    limit?: number
    includeRunningBalance?: boolean
    dateFrom?: string
    dateTo?: string
  } = {}
): Promise<{
  account_id: string
  transactions: Array<{
    id: string
    effective_date: string
    description: string
    raw_amount: string
    signed_amount: string
    account_name: string
    account_type: string
    category_name: string | null
    category_type: string | null
    category_group_name: string | null
    is_matched: boolean
    reconciliation_status: 'matched' | 'unmatched'
    is_transfer: boolean
    transfer_direction: 'incoming' | 'outgoing' | null
    other_account_name: string | null
    transfer_details: any | null
    effective_category: {
      type: 'direct' | 'uncategorized'
      category_id?: string | null
      category_name?: string
      category_type?: string
      primary_category?: any | null
    }
    running_balance?: string
  }>
  includes_running_balance: boolean
  count: number
}> {
  /**
   * Optimized account transactions endpoint
   * GET /api/v1/ledger/entries/account_transactions/?account_id=X
   */
  try {
    const searchParams = new URLSearchParams({
      account_id: accountId
    })
    
    if (params.limit) {
      searchParams.append('limit', params.limit.toString())
    }
    if (params.includeRunningBalance) {
      searchParams.append('include_running_balance', 'true')
    }
    if (params.dateFrom) {
      searchParams.append('date_from', params.dateFrom)
    }
    if (params.dateTo) {
      searchParams.append('date_to', params.dateTo)
    }
    
    const url = `${API_BASE_URL}/api/v1/ledger/entries/account_transactions/?${searchParams.toString()}`
    const response = await authenticatedFetch(url)
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new APIError(
        response.status,
        errorData.detail || 'Failed to fetch account transactions'
      )
    }
    
    return await response.json()
  } catch (error) {
    if (error instanceof APIError) {
      throw error
    }
    throw new APIError(0, 'Network error occurred')
  }
}

export async function getTransactions(
  authenticatedFetch: AuthenticatedFetch, 
  params: {
    accountId?: string
    accountIds?: string[]
    categoryId?: string
    categoryIds?: string[]
    dateFrom?: string
    dateTo?: string
    limit?: number
    month?: string
    entryType?: 'transfers'
    search?: string
    showUncategorized?: boolean
    showTransfers?: boolean
    showMatched?: boolean
    // Cursor pagination parameters
    cursor_date?: string
    cursor_id?: string
  } = {}
): Promise<{
  results: LedgerEntry[]
  has_more: boolean
  next_cursor: { cursor_date: string; cursor_id: string } | null
  count: number
  total_count: number
}> {
  /**
   * General transactions endpoint with enhanced filtering and cursor pagination
   * GET /api/v1/ledger/entries/
   */
  try {
    const searchParams = new URLSearchParams()
    
    // Account filtering - single or multiple
    if (params.accountId) {
      searchParams.append('account', params.accountId)
    }
    if (params.accountIds && params.accountIds.length > 0) {
      params.accountIds.forEach(id => searchParams.append('account', id))
    }
    
    // Category filtering - single or multiple  
    if (params.categoryId) {
      searchParams.append('category', params.categoryId) 
    }
    if (params.categoryIds && params.categoryIds.length > 0) {
      params.categoryIds.forEach(id => searchParams.append('category', id))
    }
    
    // Date range
    if (params.dateFrom) {
      searchParams.append('date_from', params.dateFrom)
    }
    if (params.dateTo) {
      searchParams.append('date_to', params.dateTo)
    }
    
    // Other filters
    if (params.limit) {
      searchParams.append('limit', params.limit.toString())
    }
    if (params.entryType) {
      searchParams.append('entry_type', params.entryType)
    }
    if (params.search) {
      searchParams.append('search', params.search)
    }
    // Note: showUncategorized, showTransfers, showMatched are handled client-side
    // since the backend list endpoint doesn't support these filters yet
    
    // Cursor pagination parameters
    if (params.cursor_date) {
      searchParams.append('cursor_date', params.cursor_date)
    }
    if (params.cursor_id) {
      searchParams.append('cursor_id', params.cursor_id)
    }
    
    // Handle month parameter - convert to date range
    if (params.month) {
      const [year, month] = params.month.split('-')
      const firstDay = `${year}-${month}-01`
      const lastDay = new Date(parseInt(year), parseInt(month), 0).toISOString().split('T')[0]
      searchParams.append('date_from', firstDay)
      searchParams.append('date_to', lastDay)
    }
    
    const url = `${API_BASE_URL}/api/v1/ledger/entries/?${searchParams.toString()}`
    const response = await authenticatedFetch(url)
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new APIError(
        response.status,
        errorData.detail || 'Failed to fetch transactions'
      )
    }
    
    const data = await response.json()
    
    // Transform API response to frontend format
    const transformedResults = (data.results || []).map((entry: any) => ({
      id: entry.id,
      account: entry.account,
      effective_date: entry.effective_date,
      description: entry.description,
      raw_amount: entry.raw_amount,
      signed_amount: entry.signed_amount,
      category: entry.category,
      is_matched: entry.is_matched,
      
      // Enhanced fields from optimized serializers  
      account_name: entry.account_name,
      account_type: entry.account_type,
      category_name: entry.category_name,
      category_type: entry.category_type,
      category_group_name: entry.category_group_name,
      is_transfer: entry.is_transfer,
      transfer_direction: entry.transfer_direction,
      other_account_name: entry.other_account_name,
      reconciliation_status: entry.reconciliation_status,
      effective_category: entry.effective_category,
    }))
    
    return {
      results: transformedResults,
      has_more: data.has_more || false,
      next_cursor: data.next_cursor || null,
      count: data.count || transformedResults.length,
      total_count: data.total_count || transformedResults.length
    }
  } catch (error) {
    if (error instanceof APIError) {
      throw error
    }
    throw new APIError(0, 'Network error occurred')
  }
}

export async function getRecentTransactions(
  authenticatedFetch: AuthenticatedFetch,
  days: number = 7
): Promise<{
  since_date: string
  count: number
  entries: LedgerEntry[]
}> {
  /**
   * Recent transactions across all accounts
   * GET /api/v1/ledger/entries/recent/?days=7
   */
  try {
    const response = await authenticatedFetch(`${API_BASE_URL}/api/v1/ledger/entries/recent/?days=${days}`)
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new APIError(
        response.status,
        errorData.detail || 'Failed to fetch recent transactions'
      )
    }
    
    return await response.json()
  } catch (error) {
    if (error instanceof APIError) {
      throw error
    }
    throw new APIError(0, 'Network error occurred')
  }
}

export async function getTransactionsSummary(
  authenticatedFetch: AuthenticatedFetch
): Promise<{
  total_entries: number
  reconciliation: {
    matched: number
    unmatched: number
  }
  amounts: {
    asset_total: string
    liability_total: string
    net_total: string
  }
}> {
  /**
   * Transaction summary statistics
   * GET /api/v1/ledger/entries/summary/
   */
  try {
    const response = await authenticatedFetch(`${API_BASE_URL}/api/v1/ledger/entries/summary/`)
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new APIError(
        response.status,
        errorData.detail || 'Failed to fetch transactions summary'
      )
    }
    
    return await response.json()
  } catch (error) {
    if (error instanceof APIError) {
      throw error
    }
    throw new APIError(0, 'Network error occurred')
  }
}

// CRUD operations remain the same
export async function createTransaction(
  authenticatedFetch: AuthenticatedFetch,
  transaction: {
    account: string
    effective_date: string
    description: string
    raw_amount: string
    category?: string
  }
): Promise<LedgerEntry> {
  try {
    const response = await authenticatedFetch(`${API_BASE_URL}/api/v1/ledger/entries/`, {
      method: 'POST',
      body: JSON.stringify(transaction)
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new APIError(
        response.status,
        errorData.detail || 'Failed to create transaction'
      )
    }
    
    const data = await response.json()
    
    return {
      id: data.id,
      account: data.account,
      effective_date: data.effective_date,
      description: data.description,
      raw_amount: data.raw_amount,
      signed_amount: data.signed_amount,
      category: data.category,
      is_matched: data.is_matched,
    }
  } catch (error) {
    if (error instanceof APIError) {
      throw error
    }
    throw new APIError(0, 'Network error occurred')
  }
}

export async function updateTransaction(
  authenticatedFetch: AuthenticatedFetch,
  id: string,
  updates: Partial<{
    effective_date: string
    description: string
    raw_amount: string
    category: string
  }>
): Promise<LedgerEntry> {
  try {
    const response = await authenticatedFetch(`${API_BASE_URL}/api/v1/ledger/entries/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(updates)
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new APIError(
        response.status,
        errorData.detail || 'Failed to update transaction'
      )
    }
    
    const data = await response.json()
    
    return {
      id: data.id,
      account: data.account,
      effective_date: data.effective_date,
      description: data.description,
      raw_amount: data.raw_amount,
      signed_amount: data.signed_amount,
      category: data.category,
      is_matched: data.is_matched,
    }
  } catch (error) {
    if (error instanceof APIError) {
      throw error
    }
    throw new APIError(0, 'Network error occurred')
  }
}

export async function deleteTransaction(
  authenticatedFetch: AuthenticatedFetch,
  id: string
): Promise<void> {
  try {
    const response = await authenticatedFetch(`${API_BASE_URL}/api/v1/ledger/entries/${id}/`, {
      method: 'DELETE'
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new APIError(
        response.status,
        errorData.detail || errorData.error || 'Failed to delete transaction'
      )
    }
  } catch (error) {
    if (error instanceof APIError) {
      throw error
    }
    throw new APIError(0, 'Network error occurred')
  }
}

export async function getFilteredTransactionIds(
  authenticatedFetch: AuthenticatedFetch,
  filters: {
    limit?: number
    accountId?: string
    categoryId?: string
    dateFrom?: string
    dateTo?: string
    entryType?: string
  }
): Promise<{
  transaction_ids: string[]
  total_count: number
  summary: {
    earliest_date: string | null
    latest_date: string | null
    affected_accounts: string[]
  }
}> {
  /**
   * Get all transaction IDs matching current filters
   * GET /api/v1/ledger/entries/filtered_ids/
   */
  try {
    const queryParams = new URLSearchParams()
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        queryParams.append(key, String(value))
      }
    })

    const response = await authenticatedFetch(
      `${API_BASE_URL}/api/v1/ledger/entries/filtered_ids/?${queryParams.toString()}`
    )
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new APIError(
        response.status,
        errorData.detail || errorData.error || 'Failed to get filtered transaction IDs'
      )
    }
    
    return await response.json()
  } catch (error) {
    if (error instanceof APIError) {
      throw error
    }
    throw new APIError(0, 'Network error occurred')
  }
}

export async function bulkUpdateTransactions(
  authenticatedFetch: AuthenticatedFetch,
  selection: {
    mode: 'individual' | 'all-filtered-except'
    entryIds?: string[]  // For individual mode or legacy support
    filters?: any        // For all-filtered-except mode
    excludedIds?: string[]  // For all-filtered-except mode
  },
  changes: {
    category?: string | null
    reconciliation_status?: 'mark_cleared' | 'mark_uncleared' | null
  }
): Promise<{
  updated_count: number
  selection_mode: string
  message: string
}> {
  /**
   * Unified bulk update supporting both selection modes
   * POST /api/v1/ledger/entries/bulk_update/
   */
  try {
    const body: any = { changes }
    
    // Handle legacy format or individual mode
    if (selection.mode === 'individual' && selection.entryIds) {
      body.entry_ids = selection.entryIds
    } else {
      body.selection = {
        mode: selection.mode,
        ...(selection.entryIds && { entry_ids: selection.entryIds }),
        ...(selection.filters && { filters: selection.filters }),
        ...(selection.excludedIds && { excluded_ids: selection.excludedIds })
      }
    }

    const response = await authenticatedFetch(`${API_BASE_URL}/api/v1/ledger/entries/bulk_update/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body)
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new APIError(
        response.status,
        errorData.detail || errorData.error || 'Failed to bulk update transactions'
      )
    }
    
    return await response.json()
  } catch (error) {
    if (error instanceof APIError) {
      throw error
    }
    throw new APIError(0, 'Network error occurred')
  }
}

export async function bulkReconcileTransactions(
  authenticatedFetch: AuthenticatedFetch,
  entryIds: string[],
  action: 'mark_cleared' | 'mark_uncleared'
): Promise<{
  message: string
  updated_count: number
  skipped_count: number
  total_requested: number
  transfer_entries_included: string[]
  skipped_entries: Array<{
    id: string
    reason: string
    description: string
  }>
  action_performed: string
}> {
  /**
   * Bulk update reconciliation status for multiple entries
   * POST /api/v1/ledger/entries/bulk_reconcile/
   */
  try {
    const response = await authenticatedFetch(`${API_BASE_URL}/api/v1/ledger/entries/bulk_reconcile/`, {
      method: 'POST',
      body: JSON.stringify({
        entry_ids: entryIds,
        reconciliation_action: action
      })
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new APIError(
        response.status,
        errorData.detail || errorData.error || 'Failed to bulk reconcile transactions'
      )
    }
    
    return await response.json()
  } catch (error) {
    if (error instanceof APIError) {
      throw error
    }
    throw new APIError(0, 'Network error occurred')
  }
}

// ---------------- Transfer API ----------------

/**
 * Create a new transfer between two accounts.
 * POST /api/v1/ledger/transfers/
 */
export async function createTransfer(
  authenticatedFetch: AuthenticatedFetch,
  transfer: {
    from_account: string
    to_account: string
    amount: string
    effective_date: string
    purpose_category: string
    description?: string
  }
) {
  try {
    const response = await authenticatedFetch(`${API_BASE_URL}/api/v1/ledger/transfers/`, {
      method: 'POST',
      body: JSON.stringify(transfer)
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new APIError(
        response.status,
        errorData.error || 'Failed to create transfer'
      )
    }

    return await response.json()
  } catch (error) {
    if (error instanceof APIError) {
      throw error
    }
    throw new APIError(0, 'Network error occurred')
  }
}
