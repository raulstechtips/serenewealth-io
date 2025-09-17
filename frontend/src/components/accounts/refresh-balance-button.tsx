"use client"

import { useState } from "react"
import { RefreshCw, CheckCircle, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { createApiClient, APIError } from "@/api/client"
import { useAuthenticatedFetch } from "@/contexts/auth-context"
import type { Account, RefreshBalanceResponse } from "@/lib/types"

interface RefreshBalanceButtonProps {
  account: Account
  onRefreshComplete?: (updatedAccount?: Account) => void
  disabled?: boolean
  variant?: "default" | "outline" | "ghost" | "destructive" | "secondary" | "link"
  size?: "default" | "sm" | "lg" | "icon"
  className?: string
  showLabel?: boolean
}

export function RefreshBalanceButton({
  account,
  onRefreshComplete,
  disabled = false,
  variant = "outline",
  size = "default",
  className = "",
  showLabel = true
}: RefreshBalanceButtonProps) {
  const authenticatedFetch = useAuthenticatedFetch()
  const apiClient = createApiClient(authenticatedFetch)
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null)
  const [refreshSuccess, setRefreshSuccess] = useState<boolean | null>(null)
  const [showRefreshDialog, setShowRefreshDialog] = useState(false)
  const [isDialogRefreshing, setIsDialogRefreshing] = useState(false)

  const handleRefreshBalance = async () => {
    try {
      setIsDialogRefreshing(true)
      setRefreshMessage(null)
      setRefreshSuccess(null)

      const result: RefreshBalanceResponse = await apiClient.refreshAccountBalance(account.id)
      
      setRefreshSuccess(true)
      setRefreshMessage(
        result.was_updated 
          ? `Balance updated! Previous: $${result.previous_balance}, Current: $${result.current_balance}`
          : 'Balance refresh completed! Balance was already correct.'
      )

      // Create updated account object with new balance
      const updatedAccount: Account = {
        ...account,
        current_balance: result.current_balance,
        cached_actual_balance: result.current_balance,
      }

      // Close dialog and notify parent with updated account
      setShowRefreshDialog(false)
      if (onRefreshComplete) {
        onRefreshComplete(updatedAccount)
      }
    } catch (err) {
      setRefreshSuccess(false)
      if (err instanceof APIError) {
        setRefreshMessage(`Failed to refresh balance: ${err.message}`)
      } else {
        setRefreshMessage('Failed to refresh balance. Please try again.')
      }
      console.error(`Error refreshing balance for account ${account.name}:`, err)
    } finally {
      setIsDialogRefreshing(false)
    }
  }

  const buttonText = showLabel 
    ? 'Refresh Balance'
    : undefined

  return (
    <div className="space-y-4">
      <AlertDialog open={showRefreshDialog} onOpenChange={setShowRefreshDialog}>
        <AlertDialogTrigger asChild>
          <Button 
            variant={variant}
            size={size}
            disabled={disabled}
            className={className}
            title={`Refresh balance for ${account.name}`}
          >
            <RefreshCw className={`${size === 'icon' ? 'h-4 w-4' : 'mr-2 h-4 w-4'}`} />
            {buttonText}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Refresh Balance for {account.name}
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will recalculate the account balance from transaction history. 
              This process might take a while for accounts with many transactions.
              <br /><br />
              <strong>Please do not leave this page during the refresh process or the sync might fail.</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDialogRefreshing}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleRefreshBalance}
              disabled={isDialogRefreshing}
            >
              {isDialogRefreshing ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Refreshing...
                </>
              ) : (
                'Continue Refresh'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Show error message if refresh failed */}
      {refreshMessage && !refreshSuccess && !isDialogRefreshing && !showRefreshDialog && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {refreshMessage}
            <Button 
              variant="outline" 
              size="sm" 
              className="ml-2" 
              onClick={() => setShowRefreshDialog(true)}
            >
              Try Again
            </Button>
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
