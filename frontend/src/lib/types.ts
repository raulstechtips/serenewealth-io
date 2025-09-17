export type Currency = "USD"

export type AccountType = "ASSET" | "LIABILITY"
export type AccountSubtype = "CHECKING" | "SAVINGS" | "CREDIT" | "LOAN" | "INVESTMENT"

export interface Account {
  id: string
  name: string
  type: AccountType 
  subtype: AccountSubtype
  currency: Currency
  current_balance: string // backend returns as string
  cached_actual_balance: string
  credit_limit?: string
  interest_rate_apr?: string
  type_display: string
  subtype_display: string
  
  // Enhanced fields from backend
  transaction_summary?: {
    total_entries: number
    recent_entries_30d: number
    recent_income_30d: string
    recent_expenses_30d: string
    recent_transfers_30d: number
    unmatched_entries: number
    last_transaction_date: string | null
  }
  recent_activity?: Array<{
    id: string
    date: string
    description: string
    amount: string
    raw_amount: string
    is_transfer: boolean
    other_account: string | null
    category_name: string | null
    is_matched: boolean
  }>
  account_health?: {
    status: 'healthy' | 'warning' | 'critical' | 'unknown'
    warnings: string[]
    balance_trend: 'increasing' | 'decreasing' | 'stable' | 'unknown'
    credit_utilization?: string
  }
}

export interface RefreshBalanceResponse {
  success: boolean
  message: string
  account_id: string
  account_name: string
  previous_balance: string
  current_balance: string
  difference: string
  was_updated: boolean
  error?: string
}

export interface LedgerEntry {
  id: string
  account: string // account UUID
  effective_date: string // ISO date
  description: string
  raw_amount: string // as entered by user
  signed_amount: string // normalized by account type
  category?: string // category UUID
  is_matched: boolean
  
  // Enhanced fields from backend
  account_name?: string
  account_type?: AccountType
  category_name?: string
  category_type?: string
  category_group_name?: string
  is_transfer?: boolean
  transfer_direction?: 'incoming' | 'outgoing' | null
  other_account_name?: string | null
  reconciliation_status?: 'matched' | 'manually_cleared' | 'unmatched'
  running_balance?: string
  
  // Detailed fields (from full serializer)
  transfer_details?: {
    transfer_id: string
    direction: 'incoming' | 'outgoing'
    other_account_id: string
    other_account_name: string
    transfer_amount: string
  } | null
  effective_category?: {
    type: 'direct' | 'uncategorized'
    category_id?: string | null
    category_name?: string
    category_type?: string
    primary_category?: {
      category_id: string
      category_name: string
      category_type: string
      amount: string
    } | null
  }
}

// UI-friendly transaction type for components
export interface Transaction {
  id: string
  accountId: string
  date: string
  amount: number
  payee?: string
  memo?: string
  category?: string
  isTransfer?: boolean
  cleared?: boolean
}

export interface CategoryGroup {
  id: string
  name: string
  type: 'INCOME' | 'EXPENSE' | 'TRANSFER'
  type_display: string
  categories_count?: number
}

export interface Category {
  id: string
  name: string
  // Group information - categories now belong to groups
  group?: CategoryGroup // Full group object (read-only)
  group_id?: string // Group ID for write operations
  group_name?: string // Group name (lightweight serializer)
  // Type inherited from group
  type: 'INCOME' | 'EXPENSE' | 'TRANSFER'
  type_display: string
  
  // Enhanced fields from backend
  entries_count?: number
  spending_summary?: {
    last_30_days: string
    last_90_days: string
    daily_average_30d: string
    daily_average_90d: string
    transaction_count_30d: number
    transaction_count_90d: number
  }
  recent_activity?: Array<{
    type: 'entry'
    id: string
    date: string
    description: string
    amount: string
    account_name: string
  }>
  category_insights?: {
    spending_trend: 'increasing' | 'decreasing' | 'stable' | 'new' | 'inactive' | 'unknown'
    month_over_month_change: string
    current_month_total: string
    previous_month_total: string
    top_accounts: Array<{
      name: string
      usage_count: number
    }>
    is_active: boolean
    category_type_context: string
  }
  
  // Legacy fields for compatibility
  color?: string // hex color for category
  ruleCount?: number // number of categorization rules
  isTransferCategory?: boolean // for internal logic
}

