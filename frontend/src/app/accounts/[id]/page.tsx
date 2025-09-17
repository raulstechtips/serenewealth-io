"use client"

import type React from "react"
import { useState, useEffect, use } from "react"

import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { AccountHealthCard } from "@/components/accounts/account-health-card"
import { TransactionSummaryCard } from "@/components/accounts/transaction-summary-card"
import { AccountOverviewCard } from "@/components/accounts/account-overview-card"
import { EnhancedTransactionsList } from "@/components/accounts/enhanced-transactions-list"
import { createOptimizedApiClient } from "@/api/client"
import { useAuthenticatedFetch } from "@/contexts/auth-context"

interface AccountDetailPageProps {
  params: Promise<{
    id: string
  }>
}

export default function OptimizedAccountDetailPage({ params }: AccountDetailPageProps) {
  const authenticatedFetch = useAuthenticatedFetch()
  const resolvedParams = use(params)
  
  const [dashboardData, setDashboardData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        setIsLoading(true)
        setError(null)
        const api = createOptimizedApiClient(authenticatedFetch)
        const data = await api.getAccountDashboard(resolvedParams.id)
        setDashboardData(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load account data')
        console.error('Error loading account dashboard:', err)
      } finally {
        setIsLoading(false)
      }
    }

    loadDashboardData()
  }, [resolvedParams.id, authenticatedFetch])

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/accounts">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Accounts
            </Link>
          </Button>
        </div>
        <div className="text-center py-12">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mx-auto mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto"></div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/accounts">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Accounts
            </Link>
          </Button>
        </div>
        <div className="text-center py-12">
          <h2 className="text-2xl font-semibold">Error loading account</h2>
          <p className="text-muted-foreground mt-2">{error}</p>
        </div>
      </div>
    )
  }

  if (!dashboardData) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/accounts">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Accounts
            </Link>
          </Button>
        </div>
        <div className="text-center py-12">
          <h2 className="text-2xl font-semibold">Account not found</h2>
          <p className="text-muted-foreground mt-2">The account you're looking for doesn't exist.</p>
        </div>
      </div>
    )
  }

  // Transform dashboard data for components
  const account = {
    ...dashboardData.account,
    // Add computed fields expected by components
    transaction_summary: dashboardData.financial_summary,
    account_health: dashboardData.health,
    recent_activity: dashboardData.recent_activity,
  }

  // Transform activity data to LedgerEntry format for transaction list
  const ledgerEntries = dashboardData.recent_activity.map((activity: any) => ({
    id: activity.id,
    account: account.id,
    effective_date: activity.date,
    description: activity.description,
    raw_amount: activity.raw_amount,
    signed_amount: activity.amount,
    category: activity.effective_category?.id,
    is_matched: activity.reconciliation_status === 'matched',
    
    // Enhanced fields
    account_name: account.name,
    account_type: account.type,
    category_name: activity.effective_category?.name,
    category_type: activity.effective_category?.category_type,
    is_transfer: activity.is_transfer,
    transfer_direction: activity.transfer_direction,
    other_account_name: activity.other_account,
    reconciliation_status: activity.reconciliation_status,
    effective_category: activity.effective_category,
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/accounts">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Accounts
          </Link>
        </Button>
      </div>

      {/* Enhanced Layout with Comprehensive Account View */}
      <div className="grid gap-6 xl:grid-cols-12">
        {/* Left Column - Account Overview and Health */}
        <div className="xl:col-span-4 space-y-6">
          {/* Account Overview */}
          <AccountOverviewCard account={account} />
          
          {/* Account Health */}
          <AccountHealthCard account={account} />
          
          {/* Transaction Summary */}
          <TransactionSummaryCard account={account} />
        </div>

        {/* Right Column - Transactions and Activity */}
        <div className="xl:col-span-8">
          <EnhancedTransactionsList 
            accountId={resolvedParams.id} 
            transactions={ledgerEntries} 
            showRunningBalance={false} // Can be toggled via setting
          />
        </div>
      </div>
    </div>
  )
}
