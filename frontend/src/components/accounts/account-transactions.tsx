"use client"

import { ArrowUpRight, ArrowDownLeft } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { Transaction } from "@/lib/types"

interface AccountTransactionsProps {
  accountId: string
  transactions: Transaction[]
}

export function AccountTransactions({ accountId, transactions }: AccountTransactionsProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(Math.abs(amount))
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  // Get last 20 transactions for this account
  const recentTransactions = transactions
    .filter((t) => t.accountId === accountId)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 20)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Transactions</CardTitle>
        <CardDescription>Last 20 transactions for this account</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {recentTransactions.map((transaction) => (
            <div key={transaction.id} className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex items-center gap-3">
                <div
                  className={`p-2 rounded-full ${
                    transaction.amount > 0 ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"
                  }`}
                >
                  {transaction.amount > 0 ? (
                    <ArrowUpRight className="h-4 w-4" />
                  ) : (
                    <ArrowDownLeft className="h-4 w-4" />
                  )}
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium leading-none">{transaction.payee || "Unknown Payee"}</p>
                  <div className="flex items-center gap-2">
                    {transaction.memo && <p className="text-xs text-muted-foreground">{transaction.memo}</p>}
                    {transaction.isTransfer && (
                      <Badge variant="outline" className="text-xs">
                        Transfer
                      </Badge>
                    )}
                    {transaction.cleared && (
                      <Badge variant="secondary" className="text-xs">
                        Cleared
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className={`text-sm font-medium ${transaction.amount > 0 ? "text-green-600" : "text-red-600"}`}>
                  {transaction.amount > 0 ? "+" : "-"}
                  {formatCurrency(transaction.amount)}
                </p>
                <p className="text-xs text-muted-foreground">{formatDate(transaction.date)}</p>
              </div>
            </div>
          ))}
          {recentTransactions.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <p>No transactions found for this account</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
