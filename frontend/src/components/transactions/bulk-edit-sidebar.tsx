"use client"

import React, { useState } from "react"
import { Loader2, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { BulkCategoryEditor } from "./bulk-category-editor"
import type { Category } from "@/lib/types"

interface BulkEditSidebarProps {
  isOpen: boolean
  onClose: () => void
  selectedCount: number
  totalFilteredCount: number
  isSelectingAll: boolean
  categories: Category[]
  onCategoryChange: (categoryId: string | null) => void
  onReconciliationChange: (status: 'mark_cleared' | 'mark_uncleared' | null) => void
  onApplyChanges: () => void
  isLoading: boolean
  pendingChanges: {
    category?: string | null
    reconciliation_status?: 'mark_cleared' | 'mark_uncleared' | null
  }
  onCategoryCreated?: (newCategory: Category) => void
}

export function BulkEditSidebar({
  isOpen,
  onClose,
  selectedCount,
  totalFilteredCount,
  isSelectingAll,
  categories,
  onCategoryChange,
  onReconciliationChange,
  onApplyChanges,
  isLoading,
  pendingChanges,
  onCategoryCreated
}: BulkEditSidebarProps) {
  
  const handleCategoryChange = (categoryId: string | null) => {
    onCategoryChange(categoryId)
  }

  const handleReconciliationChange = (value: string) => {
    const status = value === "no_change" ? null : (value as 'mark_cleared' | 'mark_uncleared')
    onReconciliationChange(status)
  }

  const hasChanges = Object.keys(pendingChanges).length > 0
  const canApply = selectedCount > 0 && hasChanges

  // Get current reconciliation display value
  const currentReconciliationValue = pendingChanges.reconciliation_status || "no_change"

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-[420px] p-0 border-0">
        {/* Header */}
        <SheetHeader className="p-6 border-b bg-background">
          <SheetTitle>Edit {selectedCount.toLocaleString()} transactions</SheetTitle>
          <p className="text-sm text-muted-foreground mt-1">
            {isSelectingAll 
              ? `All filtered transactions selected` 
              : `${selectedCount.toLocaleString()} transactions selected`
            }
          </p>
        </SheetHeader>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            
            
            {/* Category */}
            <div className="space-y-2">
              <Label htmlFor="category" className="text-sm font-medium">Category</Label>
              <BulkCategoryEditor
                categories={categories}
                selectedCategoryId={pendingChanges.category}
                onCategoryChange={handleCategoryChange}
                onCategoryCreated={onCategoryCreated}
                placeholder="Search categories..."
              />
            </div>

            {/* Date - Coming Soon */}
            <div className="space-y-2">
              <Label htmlFor="date" className="text-sm font-medium">Date</Label>
              <Button variant="outline" className="w-full justify-start text-muted-foreground" disabled>
                Change date...
              </Button>
            </div>

          </div>
        </div>

        {/* Footer */}
        <div className="border-t bg-background p-6">
          <Button
            onClick={onApplyChanges}
            disabled={!canApply || isLoading}
            className="w-full"
            size="lg"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Updating...
              </>
            ) : (
              `Update ${selectedCount.toLocaleString()} transactions`
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
