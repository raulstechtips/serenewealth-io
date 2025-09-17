"use client"

import React, { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createOptimizedApiClient } from "@/api/client"
import { useAuthenticatedFetch } from "@/contexts/auth-context"
import { useToast } from "@/hooks/use-toast"
import type { Category } from "@/lib/types"

interface AddCategoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCategoryCreated?: (category: Category) => void
}

export function AddCategoryDialog({ open, onOpenChange, onCategoryCreated }: AddCategoryDialogProps) {
  const [isCreating, setIsCreating] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState("")
  const [selectedGroupId, setSelectedGroupId] = useState("")
  const [categoryGroups, setCategoryGroups] = useState<any[]>([])
  
  const { toast } = useToast()
  const authenticatedFetch = useAuthenticatedFetch()
  const api = createOptimizedApiClient(authenticatedFetch)

  // Load category groups when dialog opens
  useEffect(() => {
    const loadCategoryGroups = async () => {
      if (!open || categoryGroups.length > 0) return
      
      try {
        const groups = await api.getCategoryGroups()
        setCategoryGroups(groups)
      } catch (error) {
        console.error('Failed to load category groups:', error)
        toast({
          title: "Error",
          description: "Failed to load category groups.",
          variant: "destructive",
        })
      }
    }
    
    loadCategoryGroups()
  }, [open]) // Remove api and toast dependencies to prevent infinite loop

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim() || !selectedGroupId) {
      toast({
        title: "Error",
        description: "Please enter a category name and select a group.",
        variant: "destructive",
      })
      return
    }

    try {
      setIsCreating(true)
      
      const newCategory = await api.createCategory({
        name: newCategoryName.trim(),
        group_id: selectedGroupId
      })
      
      toast({
        title: "Category created",
        description: `Category "${newCategory.name}" has been created.`,
      })
      
      // Notify parent about the new category
      onCategoryCreated?.(newCategory)
      
      // Close dialog and reset form
      onOpenChange(false)
      setNewCategoryName("")
      setSelectedGroupId("")
      
    } catch (error) {
      console.error('Failed to create category:', error)
      toast({
        title: "Error",
        description: "Failed to create category. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsCreating(false)
    }
  }

  const handleClose = () => {
    onOpenChange(false)
    // Reset form when closing
    setNewCategoryName("")
    setSelectedGroupId("")
  }

  // Group category groups by type (like Monarch Money)
  const groupedCategoryGroups = React.useMemo(() => {
    const types: Record<string, any[]> = {
      INCOME: [],
      EXPENSE: [],
      TRANSFER: []
    }
    
    categoryGroups.forEach(group => {
      const groupType = group.type || 'EXPENSE'
      if (types[groupType]) {
        types[groupType].push(group)
      }
    })
    
    // Sort groups within each type
    Object.keys(types).forEach(type => {
      types[type].sort((a, b) => a.name.localeCompare(b.name))
    })
    
    return types
  }, [categoryGroups])

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Category</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="category-name">Category Name</Label>
            <Input
              id="category-name"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="Enter category name..."
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="category-group">Group</Label>
            <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a group" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px] overflow-auto">
                {/* Income Groups */}
                {groupedCategoryGroups.INCOME?.length > 0 && (
                  <>
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/30 border-b">
                      Income
                    </div>
                    {groupedCategoryGroups.INCOME.map((group) => (
                      <SelectItem key={group.id} value={group.id}>
                        <div className="flex items-center gap-2">
                          <span>{group.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </>
                )}

                {/* Expense Groups */}
                {groupedCategoryGroups.EXPENSE?.length > 0 && (
                  <>
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/30 border-b">
                      Expense
                    </div>
                    {groupedCategoryGroups.EXPENSE.map((group) => (
                      <SelectItem key={group.id} value={group.id}>
                        <div className="flex items-center gap-2">
                          <span>{group.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </>
                )}

                {/* Transfer Groups */}
                {groupedCategoryGroups.TRANSFER?.length > 0 && (
                  <>
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/30 border-b">
                      Transfer
                    </div>
                    {groupedCategoryGroups.TRANSFER.map((group) => (
                      <SelectItem key={group.id} value={group.id}>
                        <div className="flex items-center gap-2">
                          <span>{group.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </>
                )}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button 
            variant="outline" 
            onClick={handleClose}
            disabled={isCreating}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleCreateCategory}
            disabled={isCreating || !newCategoryName.trim() || !selectedGroupId}
          >
            {isCreating ? "Creating..." : "Create Category"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
