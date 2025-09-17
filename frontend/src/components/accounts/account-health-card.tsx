"use client"

import { AlertTriangle, CheckCircle, XCircle, TrendingUp, TrendingDown, Minus } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import type { Account } from "@/lib/types"

interface AccountHealthCardProps {
  account: Account
}

export function AccountHealthCard({ account }: AccountHealthCardProps) {
  const health = account.account_health

  if (!health) {
    return null
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />
      case 'critical':
        return <XCircle className="h-4 w-4 text-red-600" />
      default:
        return <Minus className="h-4 w-4 text-gray-600" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'warning':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'increasing':
        return <TrendingUp className="h-4 w-4 text-green-600" />
      case 'decreasing':
        return <TrendingDown className="h-4 w-4 text-red-600" />
      case 'stable':
        return <Minus className="h-4 w-4 text-gray-600" />
      default:
        return <Minus className="h-4 w-4 text-gray-600" />
    }
  }

  const getWarningMessage = (warning: string) => {
    switch (warning) {
      case 'negative_balance':
        return 'Account has a negative balance'
      case 'high_credit_utilization':
        return 'Credit utilization is very high (>70%)'
      case 'moderate_credit_utilization':
        return 'Credit utilization is moderate (>30%)'
      case 'no_recent_activity':
        return 'No recent account activity'
      default:
        return warning.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Account Health</CardTitle>
            <CardDescription>Financial health indicators and warnings</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {getStatusIcon(health.status)}
            <Badge className={getStatusColor(health.status)}>
              {health.status.charAt(0).toUpperCase() + health.status.slice(1)}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Balance Trend */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">Balance Trend</span>
          <div className="flex items-center gap-2">
            {getTrendIcon(health.balance_trend)}
            <span className="text-sm font-medium">
              {health.balance_trend.charAt(0).toUpperCase() + health.balance_trend.slice(1)}
            </span>
          </div>
        </div>

        {/* Credit Utilization (for credit accounts) */}
        {health.credit_utilization && (
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">Credit Utilization</span>
            <Badge 
              variant={
                parseFloat(health.credit_utilization.replace('%', '')) > 70 ? 'destructive' :
                parseFloat(health.credit_utilization.replace('%', '')) > 30 ? 'outline' : 'secondary'
              }
            >
              {health.credit_utilization}
            </Badge>
          </div>
        )}

        {/* Warnings */}
        {health.warnings && health.warnings.length > 0 && (
          <div className="space-y-2">
            <span className="text-sm font-medium text-muted-foreground">Warnings</span>
            {health.warnings.map((warning, index) => (
              <Alert key={index} className="py-2">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  {getWarningMessage(warning)}
                </AlertDescription>
              </Alert>
            ))}
          </div>
        )}

        {/* No warnings message */}
        {health.status === 'healthy' && (!health.warnings || health.warnings.length === 0) && (
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle className="h-4 w-4" />
            <span className="text-sm">All systems green! Your account is in good health.</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
