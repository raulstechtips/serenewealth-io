"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { CalendarIcon } from "lucide-react"
import { format } from "date-fns"

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select" // retain for account selects
import { BulkCategoryEditor } from "@/components/transactions/bulk-category-editor"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Textarea } from "@/components/ui/textarea"

import { useToast } from "@/hooks/use-toast"
import { createOptimizedApiClient } from "@/api/client"
import { useAuthenticatedFetch } from "@/contexts/auth-context"
import { createTransfer } from "@/api/ledger"
import type { Account, Category } from "@/lib/types"

// ---------------- Schema ----------------

const transferSchema = z.object({
  from_account: z.string().min(1, "From account is required"),
  to_account: z.string().min(1, "To account is required"),
  effective_date: z.date({ required_error: "Date is required" }),
  amount: z.string().refine((val) => {
    const num = Number(val)
    return !isNaN(num) && num > 0
  }, {
    message: "Amount must be greater than zero",
  }),
  purpose_category: z.string().min(1, "Purpose category is required"),
  description: z.string().optional(),
}).refine((data) => data.from_account !== data.to_account, {
  message: "From and To accounts must be different",
  path: ["to_account"],
})

type TransferFormData = z.infer<typeof transferSchema>

interface AddTransferDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  accounts: Account[]
  categories: Category[] // categories list for purpose_category (likely EXPENSE/INCOME/TRANSFER)
  onTransferCreated?: () => void
}

export function AddTransferDialog({
  open,
  onOpenChange,
  accounts,
  categories,
  onTransferCreated,
}: AddTransferDialogProps) {
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const authenticatedFetch = useAuthenticatedFetch()
  const api = createOptimizedApiClient(authenticatedFetch)

  const form = useForm<TransferFormData>({
    resolver: zodResolver(transferSchema),
    defaultValues: {
      from_account: "",
      to_account: "",
      effective_date: new Date(),
      amount: "",
      purpose_category: "",
      description: "",
    },
  })

  const onSubmit = async (data: TransferFormData) => {
    try {
      setIsSubmitting(true)

      const payload = {
        from_account: data.from_account,
        to_account: data.to_account,
        amount: parseFloat(data.amount.replace(/,/g, '.')).toFixed(2),
        effective_date: data.effective_date.toISOString().split("T")[0],
        purpose_category: data.purpose_category,
        description: data.description ?? "",
      }

      await createTransfer(authenticatedFetch, payload)

      toast({
        title: "Transfer created",
        description: "Your transfer has been added successfully.",
      })

      form.reset()
      onOpenChange(false)
      onTransferCreated?.()
    } catch (error) {
      console.error("Error creating transfer:", error)
      toast({
        title: "Error",
        description: "Failed to create transfer. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Transfer</DialogTitle>
          <DialogDescription>Move money between your accounts.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Accounts */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="from_account"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>From Account</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select account" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {accounts.map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="to_account"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>To Account</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select account" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {accounts.map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Date & Amount */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="effective_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button variant="outline" className="w-full justify-start text-left font-normal">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount</FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        inputMode="decimal"
                        pattern="^[0-9]*[.,]?[0-9]*$"
                        placeholder="0.00"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Purpose Category */}
            <FormField
              control={form.control}
              name="purpose_category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Purpose Category</FormLabel>
                  <BulkCategoryEditor
                    categories={categories}
                    selectedCategoryId={field.value || undefined}
                    onCategoryChange={(val) => field.onChange(val ?? "")}
                    placeholder="Select category"
                  />
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (optional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="e.g., Transfer for savings" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Creating..." : "Create Transfer"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
