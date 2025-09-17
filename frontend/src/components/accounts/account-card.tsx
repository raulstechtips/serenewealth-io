"use client"

import { useState } from "react"
import { MoreHorizontal, Eye, Edit, Archive, RefreshCw } from "lucide-react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { RefreshBalanceButton } from "./refresh-balance-button"
import type { Account } from "@/lib/types"

interface AccountCardProps {
  account: Account
  onClick?: () => void
  onRefreshComplete?: (updatedAccount?: Account) => void
}

export function AccountCard({ account, onClick, onRefreshComplete }: AccountCardProps) {
  const [isHovered, setIsHovered] = useState(false)

  const formatCurrency = (amount: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(parseFloat(amount))
  }

  const getSubtypeColor = (subtype: string) => {
    switch (subtype) {
      case "CHECKING":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
      case "SAVINGS":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
      case "CREDIT":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
      case "LOAN":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200"
      case "INVESTMENT":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
    }
  }

  const getBalanceColor = (balance: string, category: string) => {
    const numBalance = parseFloat(balance)
    if (category === "ASSET") {
      return numBalance >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
    } else {
      return numBalance <= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
    }
  }

  return (
    <Card
      className={`group transition-all duration-200 ${
        isHovered 
          ? "shadow-md scale-[1.02] ring-2 ring-primary/20" 
          : "shadow-sm hover:shadow-md"
      } ${onClick ? "cursor-pointer" : ""}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="font-semibold text-base leading-6 truncate">
                {account.name}
              </h3>
              <Badge 
                variant="secondary" 
                className={`${getSubtypeColor(account.subtype)} text-xs px-2 py-1`}
              >
                {account.subtype.toLowerCase()}
              </Badge>
            </div>
            
            <div className="space-y-1">
              <div className={`text-xl font-bold ${getBalanceColor(account.current_balance, account.type)}`}>
                {formatCurrency(account.current_balance)}
              </div>
              <div className="text-sm text-muted-foreground">
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 ml-4">
            <div 
              className={`transition-opacity ${
                isHovered ? "opacity-100" : "opacity-0 group-hover:opacity-100"
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              <RefreshBalanceButton
                account={account}
                onRefreshComplete={onRefreshComplete}
                variant="ghost"
                size="icon"
                showLabel={false}
                className="h-8 w-8"
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className={`h-8 w-8 p-0 transition-opacity ${
                    isHovered ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                  }`}
                  onClick={(e) => {
                    e.stopPropagation()
                  }}
                >
                  <span className="sr-only">Open menu</span>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href={`/accounts/${account.id}`}>
                    <Eye className="mr-2 h-4 w-4" />
                    View Details
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit Account
                </DropdownMenuItem>
                <DropdownMenuItem className="text-destructive">
                  <Archive className="mr-2 h-4 w-4" />
                  Archive Account
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
