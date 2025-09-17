"use client"

import { TrendingUp, TrendingDown, ArrowRightLeft, AlertCircle, Calendar } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { Account } from "@/lib/types"

interface TransactionSummaryCardProps {
  account: Account
}

export function TransactionSummaryCard({ account }: TransactionSummaryCardProps) {
  const summary = account.transaction_summary

  if (!summary) {
    return null
  }

  const formatCurrency = (amount: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(parseFloat(amount))
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Never"
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">30-Day Activity Summary</CardTitle>
        <CardDescription>Recent transaction patterns and statistics</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Key Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 bg-green-50 rounded-lg border border-green-200">
            <div className="flex items-center justify-center gap-1 mb-1">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <span className="text-xs font-medium text-green-600">Income</span>
            </div>
            <p className="text-lg font-semibold text-green-700">
              {formatCurrency(summary.recent_income_30d)}
            </p>
          </div>
          
          <div className="text-center p-3 bg-red-50 rounded-lg border border-red-200">
            <div className="flex items-center justify-center gap-1 mb-1">
              <TrendingDown className="h-4 w-4 text-red-600" />
              <span className="text-xs font-medium text-red-600">Expenses</span>
            </div>
            <p className="text-lg font-semibold text-red-700">
              {formatCurrency(summary.recent_expenses_30d)}
            </p>
          </div>
        </div>

        {/* Additional Stats */}
        <div className="space-y-3">
          {/* Total Transactions */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">Recent Transactions</span>
            <Badge variant="outline">
              {summary.recent_entries_30d} of {summary.total_entries} total
            </Badge>
          </div>

          {/* Transfers */}
          {summary.recent_transfers_30d > 0 && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-muted-foreground">Transfers</span>
              </div>
              <Badge variant="secondary">
                {summary.recent_transfers_30d}
              </Badge>
            </div>
          )}

          {/* Unmatched Entries */}
          {summary.unmatched_entries > 0 && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-yellow-600" />
                <span className="text-sm font-medium text-muted-foreground">Unmatched</span>
              </div>
              <Badge variant="outline" className="text-yellow-700 border-yellow-300">
                {summary.unmatched_entries}
              </Badge>
            </div>
          )}

          {/* Last Transaction */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-600" />
              <span className="text-sm font-medium text-muted-foreground">Last Transaction</span>
            </div>
            <span className="text-sm font-medium">
              {formatDate(summary.last_transaction_date)}
            </span>
          </div>
        </div>

        {/* Net Flow (Income - Expenses) */}
        <div className="pt-3 border-t">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">Net Flow (30d)</span>
            {(() => {
              const netFlow = parseFloat(summary.recent_income_30d) - parseFloat(summary.recent_expenses_30d)
              const isPositive = netFlow >= 0
              return (
                <div className={`flex items-center gap-1 ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                  {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  <span className="font-semibold">
                    {formatCurrency(Math.abs(netFlow).toString())}
                  </span>
                </div>
              )
            })()}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
