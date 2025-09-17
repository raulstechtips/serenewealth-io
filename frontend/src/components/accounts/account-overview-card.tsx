"use client"

import { Plus, ArrowRightLeft, RefreshCw, Settings, CreditCard, Wallet } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import type { Account } from "@/lib/types"

interface AccountOverviewCardProps {
  account: Account
}

export function AccountOverviewCard({ account }: AccountOverviewCardProps) {
  const formatCurrency = (amount: string | number) => {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(numAmount)
  }

  const getSubtypeColor = (subtype: string) => {
    switch (subtype) {
      case "CHECKING":
        return "bg-blue-100 text-blue-800 border-blue-300"
      case "SAVINGS":
        return "bg-green-100 text-green-800 border-green-300"
      case "CREDIT":
        return "bg-red-100 text-red-800 border-red-300"
      case "LOAN":
        return "bg-orange-100 text-orange-800 border-orange-300"
      case "INVESTMENT":
        return "bg-purple-100 text-purple-800 border-purple-300"
      default:
        return "bg-gray-100 text-gray-800 border-gray-300"
    }
  }

  const getAccountIcon = (subtype: string) => {
    switch (subtype) {
      case "CREDIT":
        return <CreditCard className="h-5 w-5" />
      default:
        return <Wallet className="h-5 w-5" />
    }
  }

  const getBalanceColorClass = () => {
    const balance = parseFloat(account.current_balance)
    if (account.type === "ASSET") {
      return balance >= 0 ? "text-green-600" : "text-red-600"
    } else {
      // For liabilities, lower balance is better
      return balance <= 0 ? "text-green-600" : "text-red-600"
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 rounded-lg">
              {getAccountIcon(account.subtype)}
            </div>
            <div>
              <CardTitle className="text-2xl">{account.name}</CardTitle>
              <CardDescription>Account Details & Actions</CardDescription>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge variant={account.type === "ASSET" ? "default" : "destructive"}>
              {account.type_display}
            </Badge>
            <Badge className={getSubtypeColor(account.subtype)}>
              {account.subtype_display}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Balance Section */}
        <div className="text-center space-y-2">
          <div className="text-sm font-medium text-muted-foreground">
            Current Balance
          </div>
          <div className={`text-4xl font-bold ${getBalanceColorClass()}`}>
            {formatCurrency(account.current_balance)}
          </div>
          {account.type === "LIABILITY" && parseFloat(account.current_balance) > 0 && (
            <div className="text-sm text-muted-foreground">
              Amount Owed
            </div>
          )}
        </div>

        {/* Credit Limit (for credit accounts) */}
        {account.subtype === "CREDIT" && account.credit_limit && (
          <>
            <Separator />
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Credit Limit</span>
                <span className="font-medium">{formatCurrency(account.credit_limit)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Available Credit</span>
                <span className="font-medium text-green-600">
                  {formatCurrency(parseFloat(account.credit_limit) - Math.abs(parseFloat(account.current_balance)))}
                </span>
              </div>
              {/* Credit Utilization Bar */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Utilization</span>
                  <span className="text-muted-foreground">
                    {((Math.abs(parseFloat(account.current_balance)) / parseFloat(account.credit_limit)) * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-300 ${
                      (Math.abs(parseFloat(account.current_balance)) / parseFloat(account.credit_limit)) > 0.7 
                        ? 'bg-red-500' 
                        : (Math.abs(parseFloat(account.current_balance)) / parseFloat(account.credit_limit)) > 0.3 
                          ? 'bg-yellow-500' 
                          : 'bg-green-500'
                    }`}
                    style={{
                      width: `${Math.min((Math.abs(parseFloat(account.current_balance)) / parseFloat(account.credit_limit)) * 100, 100)}%`
                    }}
                  />
                </div>
              </div>
            </div>
          </>
        )}

        {/* Interest Rate (if applicable) */}
        {account.interest_rate_apr && (
          <>
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Interest Rate (APR)</span>
              <Badge variant="outline">
                {parseFloat(account.interest_rate_apr).toFixed(2)}%
              </Badge>
            </div>
          </>
        )}
        
        <Separator />

        {/* Action Buttons */}
        <div className="space-y-3">
          <Button className="w-full" size="lg">
            <Plus className="mr-2 h-4 w-4" />
            New Transaction
          </Button>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" className="bg-transparent">
              <ArrowRightLeft className="mr-2 h-4 w-4" />
              Transfer
            </Button>
            <Button variant="outline" className="bg-transparent">
              <RefreshCw className="mr-2 h-4 w-4" />
              Reconcile
            </Button>
          </div>
          <Button variant="ghost" className="w-full">
            <Settings className="mr-2 h-4 w-4" />
            Account Settings
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
