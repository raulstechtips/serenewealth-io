import type { Account } from '@/lib/types'
import type { AuthenticatedFetch } from "@/api/client"
import { APIError } from "@/api/client"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

// Optimized Account API functions using new backend endpoints

export async function getAccountsList(authenticatedFetch: AuthenticatedFetch): Promise<Account[]> {
  /**
   * Fast list endpoint - uses AccountListSerializer with minimal queries
   * GET /api/v1/ledger/accounts/ 
   */
  try {
    const response = await authenticatedFetch(`${API_BASE_URL}/api/v1/ledger/accounts/`)
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new APIError(
        response.status,
        errorData.detail || 'Failed to fetch accounts'
      )
    }
    
    const data = await response.json()
    
    // Transform backend data to frontend format
    return data.map((account: any) => ({
      id: account.id,
      name: account.name,
      type: account.type,
      subtype: account.subtype,
      currency: account.currency,
      current_balance: account.current_balance,
      type_display: account.type_display,
      subtype_display: account.subtype_display,
      
      // Basic stats from backend
      entries_count: account.entries_count,
      last_transaction_date: account.last_transaction_date,
      unmatched_count: account.unmatched_count,
    }))
  } catch (error) {
    if (error instanceof APIError) {
      throw error
    }
    throw new APIError(0, 'Network error occurred')
  }
}

export async function getAccountDetail(
  authenticatedFetch: AuthenticatedFetch, 
  id: string
): Promise<Account> {
  /**
   * Basic account detail - uses standard AccountSerializer
   * GET /api/v1/ledger/accounts/{id}/
   */
  try {
    const response = await authenticatedFetch(`${API_BASE_URL}/api/v1/ledger/accounts/${id}/`)
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new APIError(
        response.status,
        errorData.detail || 'Failed to fetch account'
      )
    }
    
    const data = await response.json()
    
    return {
      id: data.id,
      name: data.name,
      type: data.type,
      subtype: data.subtype,
      currency: data.currency,
      current_balance: data.current_balance,
      cached_actual_balance: data.cached_actual_balance,
      credit_limit: data.credit_limit,
      interest_rate_apr: data.interest_rate_apr,
      type_display: data.type_display,
      subtype_display: data.subtype_display,
    }
  } catch (error) {
    if (error instanceof APIError) {
      throw error
    }
    throw new APIError(0, 'Network error occurred')
  }
}

export async function getAccountFinancialSummary(
  authenticatedFetch: AuthenticatedFetch, 
  id: string
): Promise<{
  account_id: string
  account_name: string
  account_type: string
  current_balance: string
  summary: {
    total_entries: number
    recent_entries_30d: number
    recent_income_30d: string
    recent_expenses_30d: string
    recent_transfers_30d: number
    unmatched_entries: number
    last_transaction_date: string | null
    net_flow_30d: string
  }
}> {
  /**
   * Rich financial summary - optimized single query
   * GET /api/v1/ledger/accounts/{id}/financial_summary/
   */
  try {
    const response = await authenticatedFetch(`${API_BASE_URL}/api/v1/ledger/accounts/${id}/financial_summary/`)
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new APIError(
        response.status,
        errorData.detail || 'Failed to fetch financial summary'
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

export async function getAccountHealth(
  authenticatedFetch: AuthenticatedFetch, 
  id: string
): Promise<{
  account_id: string
  health: {
    status: 'healthy' | 'warning' | 'critical'
    warnings: string[]
    balance_trend: 'increasing' | 'decreasing' | 'stable'
    credit_utilization?: string
  }
}> {
  /**
   * Account health indicators
   * GET /api/v1/ledger/accounts/{id}/health/
   */
  try {
    const response = await authenticatedFetch(`${API_BASE_URL}/api/v1/ledger/accounts/${id}/health/`)
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new APIError(
        response.status,
        errorData.detail || 'Failed to fetch account health'
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

export async function getAccountActivity(
  authenticatedFetch: AuthenticatedFetch, 
  id: string,
  limit: number = 10
): Promise<{
  account_id: string
  activity: Array<{
    id: string
    date: string
    description: string
    amount: string
    raw_amount: string
    is_transfer: boolean
    transfer_direction: 'incoming' | 'outgoing' | null
    other_account: string | null
    effective_category: {
      type: 'direct' | 'uncategorized'
      name?: string
      id?: string
      primary_category?: string
    }
    reconciliation_status: 'matched' | 'unmatched'
  }>
}> {
  /**
   * Rich recent activity with transfer and category context
   * GET /api/v1/ledger/accounts/{id}/activity/
   */
  try {
    const response = await authenticatedFetch(`${API_BASE_URL}/api/v1/ledger/accounts/${id}/activity/?limit=${limit}`)
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new APIError(
        response.status,
        errorData.detail || 'Failed to fetch account activity'
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

export async function getAccountDashboard(
  authenticatedFetch: AuthenticatedFetch, 
  id: string
): Promise<{
  account: Account
  financial_summary: any
  health: any
  recent_activity: any[]
}> {
  /**
   * Complete dashboard data in single optimized call
   * GET /api/v1/ledger/accounts/{id}/dashboard/
   */
  try {
    const response = await authenticatedFetch(`${API_BASE_URL}/api/v1/ledger/accounts/${id}/dashboard/`)
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new APIError(
        response.status,
        errorData.detail || 'Failed to fetch account dashboard'
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

// Keep existing CRUD operations
export interface CreateAccountRequest {
  name: string
  type: "ASSET" | "LIABILITY"
  subtype: "CHECKING" | "SAVINGS" | "CREDIT" | "LOAN" | "INVESTMENT"
  currency: "USD"
  opening_balance?: string
}

export async function createAccount(
  authenticatedFetch: AuthenticatedFetch, 
  account: CreateAccountRequest
): Promise<Account> {
  try {
    const requestBody: any = {
      name: account.name,
      type: account.type,
      subtype: account.subtype,
      currency: account.currency
    }

    // Include opening_balance if provided and not zero
    if (account.opening_balance && account.opening_balance !== "0" && account.opening_balance !== "0.00") {
      requestBody.opening_balance = account.opening_balance
    }

    const response = await authenticatedFetch(`${API_BASE_URL}/api/v1/ledger/accounts/`, {
      method: 'POST',
      body: JSON.stringify(requestBody)
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new APIError(
        response.status,
        errorData.detail || 'Failed to create account'
      )
    }
    
    const data = await response.json()
    
    return {
      id: data.id,
      name: data.name,
      type: data.type,
      subtype: data.subtype,
      currency: data.currency,
      current_balance: data.current_balance,
      cached_actual_balance: data.cached_actual_balance,
      credit_limit: data.credit_limit,
      interest_rate_apr: data.interest_rate_apr,
      type_display: data.type_display,
      subtype_display: data.subtype_display
    }
  } catch (error) {
    if (error instanceof APIError) {
      throw error
    }
    throw new APIError(0, 'Network error occurred')
  }
}

export async function updateAccount(
  authenticatedFetch: AuthenticatedFetch, 
  id: string, 
  updates: Partial<Pick<Account, 'name' | 'type' | 'subtype' | 'currency'>>
): Promise<Account> {
  try {
    const response = await authenticatedFetch(`${API_BASE_URL}/api/v1/ledger/accounts/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(updates)
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new APIError(
        response.status,
        errorData.detail || 'Failed to update account'
      )
    }
    
    const data = await response.json()
    
    return {
      id: data.id,
      name: data.name,
      type: data.type,
      subtype: data.subtype,
      currency: data.currency,
      current_balance: data.current_balance,
      cached_actual_balance: data.cached_actual_balance,
      credit_limit: data.credit_limit,
      interest_rate_apr: data.interest_rate_apr,
      type_display: data.type_display,
      subtype_display: data.subtype_display
    }
  } catch (error) {
    if (error instanceof APIError) {
      throw error
    }
    throw new APIError(0, 'Network error occurred')
  }
}

export async function deleteAccount(authenticatedFetch: AuthenticatedFetch, id: string): Promise<void> {
  try {
    const response = await authenticatedFetch(`${API_BASE_URL}/api/v1/ledger/accounts/${id}/`, {
      method: 'DELETE'
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new APIError(
        response.status,
        errorData.detail || errorData.error || 'Failed to delete account'
      )
    }
  } catch (error) {
    if (error instanceof APIError) {
      throw error
    }
    throw new APIError(0, 'Network error occurred')
  }
}

export async function refreshAccountBalance(
  authenticatedFetch: AuthenticatedFetch, 
  id: string
): Promise<{
  success: boolean
  message: string
  account_id: string
  account_name: string
  previous_balance: string
  current_balance: string
  difference: string
  was_updated: boolean
}> {
  /**
   * Refresh account balance by recalculating from ledger entries
   * POST /api/v1/ledger/accounts/{id}/refresh_balance/
   */
  try {
    const response = await authenticatedFetch(`${API_BASE_URL}/api/v1/ledger/accounts/${id}/refresh_balance/`, {
      method: 'POST'
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new APIError(
        response.status,
        errorData.detail || errorData.error || 'Failed to refresh account balance'
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
