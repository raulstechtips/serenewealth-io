"use client"

import { SummaryCards } from "@/components/dashboard/summary-cards"
import { BudgetChart } from "@/components/dashboard/budget-chart"
import { RecentTransactions } from "@/components/dashboard/recent-transactions"

export default function DashboardPage() {
  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="space-y-2">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-balance">Dashboard</h1>
        <p className="text-muted-foreground text-sm md:text-base">Welcome to your personal finance overview</p>
      </div>

      <SummaryCards />

      <div className="grid gap-4 md:gap-6 lg:grid-cols-2">
        <BudgetChart />
        <RecentTransactions />
      </div>
    </div>
  )
}
