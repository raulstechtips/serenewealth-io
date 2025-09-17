"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Plus, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AccountCard } from "@/components/accounts/account-card"
import { CollapsibleSection } from "@/components/accounts/collapsible-section"
import { AddAccountDialog } from "@/components/accounts/add-account-dialog"
import { AccountFilters } from "@/components/accounts/account-filters"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { createApiClient, APIError } from "@/api/client"
import { useAuthenticatedFetch } from "@/contexts/auth-context"
import type { Account, AccountType, AccountSubtype } from "@/lib/types"

// Helper functions for account grouping and summary calculations
function getAccountSummary(accounts: Account[]) {
  const assets = accounts.filter(acc => acc.type === "ASSET")
  const liabilities = accounts.filter(acc => acc.type === "LIABILITY")
  
  const assetsTotal = assets.reduce((sum, acc) => {
    // Use current_balance or cached_actual_balance as fallback
    const balance = parseFloat(acc.current_balance || acc.cached_actual_balance || "0")
    return sum + balance
  }, 0)
  
  const liabilitiesTotal = liabilities.reduce((sum, acc) => {
    // Use current_balance or cached_actual_balance as fallback
    const balance = parseFloat(acc.current_balance || acc.cached_actual_balance || "0")
    // For liabilities, negative balance means you owe money (normal state)
    // We want to show the absolute amount owed
    return sum + Math.abs(balance)
  }, 0)
  
  const netWorth = assetsTotal - liabilitiesTotal
  
  return {
    assets: {
      count: assets.length,
      total: assetsTotal
    },
    liabilities: {
      count: liabilities.length,
      total: liabilitiesTotal
    },
    netWorth
  }
}

interface AccountGroup {
  type: AccountType
  subtype: AccountSubtype
  accounts: Account[]
  total: number
}

function groupAccountsBySubtype(accounts: Account[]): Record<string, AccountGroup> {
  const groups: Record<string, AccountGroup> = {}
  
  accounts.forEach(account => {
    const key = `${account.type}_${account.subtype}`
    
    if (!groups[key]) {
      groups[key] = {
        type: account.type,
        subtype: account.subtype,
        accounts: [],
        total: 0
      }
    }
    
    groups[key].accounts.push(account)
    // Use current_balance or cached_actual_balance as fallback
    const balance = parseFloat(account.current_balance || account.cached_actual_balance || "0")
    
    // For assets, positive balance is good
    // For liabilities, we show absolute value (amount owed)
    if (account.type === "LIABILITY") {
      groups[key].total += Math.abs(balance)
    } else {
      groups[key].total += balance
    }
  })
  
  return groups
}

export default function AccountsPage() {
  const router = useRouter()
  const authenticatedFetch = useAuthenticatedFetch()
  const apiClient = createApiClient(authenticatedFetch)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [filters, setFilters] = useState({
    search: "",
    type: "all" as AccountType | "all",
    subtype: "all" as AccountSubtype | "all",
  })

  // State for API data
  const [accounts, setAccounts] = useState<Account[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch accounts on component mount
  useEffect(() => {
    loadAccounts()
  }, [])

  const loadAccounts = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const fetchedAccounts = await apiClient.getAccounts()
      setAccounts(fetchedAccounts)
    } catch (err) {
      if (err instanceof APIError) {
        setError(err.message)
      } else {
        setError('Failed to load accounts')
      }
      console.error('Error loading accounts:', err)
    } finally {
      setIsLoading(false)
    }
  }


  const filteredAccounts = useMemo(() => {
    return accounts.filter((account: Account) => {
      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase()
        if (!account.name.toLowerCase().includes(searchLower)) {
          return false
        }
      }

      // Type filter
      if (filters.type !== "all" && account.type !== filters.type) {
        return false
      }

      // Subtype filter
      if (filters.subtype !== "all" && account.subtype !== filters.subtype) {
        return false
      }
      return true
    })
  }, [accounts, filters])

  // Group accounts by type and subtype for the card layout
  const accountGroups = useMemo(() => {
    const summary = getAccountSummary(filteredAccounts)
    const subtypeGroups = groupAccountsBySubtype(filteredAccounts)
    
    return {
      assets: {
        ...summary.assets,
        subtypes: Object.values(subtypeGroups).filter(group => group.type === "ASSET")
      },
      liabilities: {
        ...summary.liabilities,
        subtypes: Object.values(subtypeGroups).filter(group => group.type === "LIABILITY")
      },
      netWorth: summary.netWorth
    }
  }, [filteredAccounts])

  const handleAccountClick = (account: Account) => {
    // Navigate to account details page (same as "View Details" in dropdown)
    router.push(`/accounts/${account.id}`)
  }

  const handleAccountRefresh = (updatedAccount?: Account) => {
    if (updatedAccount) {
      // Update the specific account in the state instead of reloading all accounts
      setAccounts(prevAccounts => 
        prevAccounts.map(account => 
          account.id === updatedAccount.id ? updatedAccount : account
        )
      )
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount)
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-balance">Accounts</h1>
          <p className="text-muted-foreground text-sm md:text-base">
            Manage your financial accounts • Net Worth: {formatCurrency(accountGroups.netWorth)}
          </p>
        </div>
        <Button onClick={() => setShowAddDialog(true)} className="w-full sm:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          Add Account
        </Button>
      </div>

      <AccountFilters filters={filters} onFiltersChange={setFilters} />

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error}
            <Button 
              variant="outline" 
              size="sm" 
              className="ml-2" 
              onClick={loadAccounts}
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="mt-2 text-sm text-muted-foreground">Loading accounts...</p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Assets Section */}
          {accountGroups.assets.count > 0 && (
            <CollapsibleSection
              title="Assets"
              subtitle="Money you own"
              count={accountGroups.assets.count}
              totalBalance={accountGroups.assets.total}
              defaultOpen={true}
              storageKey="assets-main"
            >
              <div className="space-y-4">
                {accountGroups.assets.subtypes.map((subtypeGroup) => (
                  <CollapsibleSection
                    key={`ASSET_${subtypeGroup.subtype}`}
                    title={subtypeGroup.subtype.charAt(0) + subtypeGroup.subtype.slice(1).toLowerCase()}
                    count={subtypeGroup.accounts.length}
                    totalBalance={subtypeGroup.total}
                    defaultOpen={true}
                    storageKey={`assets-${subtypeGroup.subtype.toLowerCase()}`}
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {subtypeGroup.accounts.map((account) => (
                          <AccountCard
                            key={account.id}
                            account={account}
                            onClick={() => handleAccountClick(account)}
                            onRefreshComplete={handleAccountRefresh}
                          />
                      ))}
                    </div>
                  </CollapsibleSection>
                ))}
              </div>
            </CollapsibleSection>
          )}

          {/* Liabilities Section */}
          {accountGroups.liabilities.count > 0 && (
            <CollapsibleSection
              title="Liabilities"
              subtitle="Money you owe"
              count={accountGroups.liabilities.count}
              totalBalance={accountGroups.liabilities.total}
              defaultOpen={true}
              storageKey="liabilities-main"
            >
              <div className="space-y-4">
                {accountGroups.liabilities.subtypes.map((subtypeGroup) => (
                  <CollapsibleSection
                    key={`LIABILITY_${subtypeGroup.subtype}`}
                    title={subtypeGroup.subtype.charAt(0) + subtypeGroup.subtype.slice(1).toLowerCase()}
                    count={subtypeGroup.accounts.length}
                    totalBalance={subtypeGroup.total}
                    defaultOpen={true}
                    storageKey={`liabilities-${subtypeGroup.subtype.toLowerCase()}`}
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {subtypeGroup.accounts.map((account) => (
                          <AccountCard
                            key={account.id}
                            account={account}
                            onClick={() => handleAccountClick(account)}
                            onRefreshComplete={handleAccountRefresh}
                          />
                      ))}
                    </div>
                  </CollapsibleSection>
                ))}
              </div>
            </CollapsibleSection>
          )}

          {/* Empty State */}
          {accountGroups.assets.count === 0 && accountGroups.liabilities.count === 0 && (
            <div className="text-center py-12">
              <h3 className="text-lg font-medium text-muted-foreground mb-2">No accounts found</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Get started by adding your first account
              </p>
              <Button onClick={() => setShowAddDialog(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Account
              </Button>
            </div>
          )}
        </div>
      )}

      <AddAccountDialog 
        open={showAddDialog} 
        onOpenChange={setShowAddDialog} 
        onAccountCreated={loadAccounts}
      />
    </div>
  )
}
