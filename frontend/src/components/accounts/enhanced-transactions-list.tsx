"use client"

import { ArrowUpRight, ArrowDownLeft, ArrowRightLeft, CheckCircle, AlertCircle, Clock } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { LedgerEntry } from "@/lib/types"

interface EnhancedTransactionsListProps {
  accountId: string
  transactions: LedgerEntry[]
  showRunningBalance?: boolean
}

export function EnhancedTransactionsList({ 
  accountId, 
  transactions, 
  showRunningBalance = false 
}: EnhancedTransactionsListProps) {
  const formatCurrency = (amount: string | number) => {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(Math.abs(numAmount))
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  const getReconciliationIcon = (status?: string) => {
    switch (status) {
      case 'matched':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'manually_cleared':
        return <CheckCircle className="h-4 w-4 text-blue-600" />
      case 'unmatched':
      default:
        return <Clock className="h-4 w-4 text-yellow-600" />
    }
  }

  const getReconciliationColor = (status?: string) => {
    switch (status) {
      case 'matched':
        return 'bg-green-100 text-green-800 border-green-300'
      case 'manually_cleared':
        return 'bg-blue-100 text-blue-800 border-blue-300'
      case 'unmatched':
      default:
        return 'bg-yellow-100 text-yellow-800 border-yellow-300'
    }
  }

  const getTransactionIcon = (entry: LedgerEntry) => {
    if (entry.is_transfer) {
      return <ArrowRightLeft className="h-4 w-4" />
    }
    const amount = parseFloat(entry.signed_amount)
    return amount > 0 ? (
      <ArrowUpRight className="h-4 w-4" />
    ) : (
      <ArrowDownLeft className="h-4 w-4" />
    )
  }

  const getTransactionIconColor = (entry: LedgerEntry) => {
    if (entry.is_transfer) {
      return "bg-blue-100 text-blue-600"
    }
    const amount = parseFloat(entry.signed_amount)
    return amount > 0 ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"
  }

  // Sort transactions by date (most recent first)
  const sortedTransactions = [...transactions]
    .sort((a, b) => new Date(b.effective_date).getTime() - new Date(a.effective_date).getTime())
    .slice(0, 20) // Show last 20 transactions

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Recent Transactions</CardTitle>
            <CardDescription>
              Last {sortedTransactions.length} transactions with enhanced details
            </CardDescription>
          </div>
          <Button variant="outline" size="sm">
            View All
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {sortedTransactions.map((transaction) => (
            <div key={transaction.id} className="flex items-center justify-between p-4 rounded-lg border hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-4">
                {/* Transaction Icon */}
                <div className={`p-2 rounded-full ${getTransactionIconColor(transaction)}`}>
                  {getTransactionIcon(transaction)}
                </div>
                
                {/* Transaction Details */}
                <div className="space-y-1 min-w-0 flex-1">
                  {/* Primary Description */}
                  <p className="text-sm font-medium leading-none">
                    {transaction.is_transfer && transaction.other_account_name
                      ? `Transfer ${transaction.transfer_direction === 'incoming' ? 'from' : 'to'} ${transaction.other_account_name}`
                      : transaction.description
                    }
                  </p>
                  
                  {/* Secondary Info */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Date */}
                    <span className="text-xs text-muted-foreground">
                      {formatDate(transaction.effective_date)}
                    </span>
                    
                    {/* Category */}
                    {transaction.category_name && (
                      <Badge variant="outline" className="text-xs">
                        {transaction.category_name}
                      </Badge>
                    )}
                    
                    {/* Transfer Badge */}
                    {transaction.is_transfer && (
                      <Badge variant="secondary" className="text-xs">
                        Transfer
                      </Badge>
                    )}
                    
                    {/* Reconciliation Status */}
                    <div className="flex items-center gap-1">
                      {getReconciliationIcon(transaction.reconciliation_status)}
                      <Badge className={`text-xs ${getReconciliationColor(transaction.reconciliation_status)}`}>
                        {transaction.reconciliation_status === 'matched' ? 'Matched' :
                         transaction.reconciliation_status === 'manually_cleared' ? 'Cleared' : 'Pending'}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Amount and Running Balance */}
              <div className="text-right space-y-1">
                {/* Transaction Amount */}
                <p className={`text-sm font-medium ${
                  parseFloat(transaction.signed_amount) > 0 ? "text-green-600" : "text-red-600"
                }`}>
                  {parseFloat(transaction.signed_amount) > 0 ? "+" : ""}
                  {formatCurrency(transaction.signed_amount)}
                </p>
                
                {/* Running Balance */}
                {showRunningBalance && transaction.running_balance && (
                  <p className="text-xs text-muted-foreground">
                    Balance: {formatCurrency(transaction.running_balance)}
                  </p>
                )}
              </div>
            </div>
          ))}
          
          {sortedTransactions.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <AlertCircle className="h-8 w-8 mx-auto mb-2 text-gray-400" />
              <p>No transactions found for this account</p>
              <p className="text-sm">Start by adding your first transaction</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
