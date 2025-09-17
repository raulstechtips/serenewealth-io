"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { CalendarIcon, Plus, Trash2 } from "lucide-react"
import { Minus } from "lucide-react"
import { format } from "date-fns"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { BulkCategoryEditor } from "@/components/transactions/bulk-category-editor"
import { Checkbox } from "@/components/ui/checkbox"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { useToast } from "@/hooks/use-toast"
import { createOptimizedApiClient } from "@/api/client"
import { useAuthenticatedFetch } from "@/contexts/auth-context"
import type { Account, Category } from "@/lib/types"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"


const transactionSchema = z.object({
  account: z.string().min(1, "Account is required"),
  effective_date: z.date({ required_error: "Date is required" }),
  raw_amount: z.string().refine((val) => {
    const num = Number(val)
    return !isNaN(num) && num !== 0
  }, {
    message: "Amount cannot be zero",
  }),
  description: z.string().min(1, "Description is required"),
  // direction: 'out' means money leaves the user's pocket. 'in' means money comes in.
  direction: z.enum(["out", "in"]),
  category: z.string().optional(),
}).refine((data) => {
  // Category  must be provided
    return data.category ? true : false // Must have category 
}, {
  message: "Transaction must have a category",
})

type TransactionFormData = z.infer<typeof transactionSchema>

interface AddTransactionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  accounts: Account[]
  categories: Category[]
  onTransactionCreated?: () => void
}

export function AddTransactionDialog({ 
  open, 
  onOpenChange, 
  accounts, 
  categories, 
  onTransactionCreated 
}: AddTransactionDialogProps) {
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const authenticatedFetch = useAuthenticatedFetch()
  const api = createOptimizedApiClient(authenticatedFetch)

  const form = useForm<TransactionFormData>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      account: "",
      effective_date: new Date(),
      raw_amount: "",
      description: "",
      direction: "out",
      category: "",
    },
  })

  const onSubmit = async (data: TransactionFormData) => {
    try {
      setIsSubmitting(true)
      
      // Look up account type to determine sign rules
      const selectedAccount = accounts.find(acc => acc.id === data.account)
      const absAmount = Math.abs(parseFloat(data.raw_amount.replace(/,/g, '.')))

      const isLiability = selectedAccount?.type === "LIABILITY"

      let signedRaw: number
      if (isLiability) {
        // Liability account: Debit (money out / charge) -> positive, Credit (payment) -> negative
        signedRaw = data.direction === "out" ? -absAmount : absAmount
      } else {
        // Asset account: Debit (expense) -> negative, Credit (income) -> positive
        signedRaw = data.direction === "out" ? -absAmount : absAmount
      }

      const payload: any = {
        account: data.account,
        effective_date: data.effective_date.toISOString().split('T')[0],
        description: data.description,
        raw_amount: signedRaw.toFixed(2),
        category: data.category,
      }
      
      console.log("Create Transaction payload", payload)
      await api.createTransaction(payload)
      
      toast({
        title: "Transaction created",
        description: "Your transaction has been added successfully.",
      })
      
      form.reset()
      onOpenChange(false)
      onTransactionCreated?.()
    } catch (error) {
      console.error('Error creating transaction:', error)
      toast({
        title: "Error",
        description: "Failed to create transaction. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`sm:max-w-[500px] max-h-[90vh] overflow-y-auto`}>
        <DialogHeader>
          <DialogTitle>Add New Transaction</DialogTitle>
          <DialogDescription>Record a new financial transaction in your ledger.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Money direction selector at top */}
            <FormField
              control={form.control}
              name="direction"
              render={({ field }) => (
                <FormItem className="w-full">
                  {/* Hidden label for accessibility */}
                  <FormLabel className="sr-only">Direction</FormLabel>
                  <ToggleGroup
                    type="single"
                    value={field.value}
                    onValueChange={(val) => field.onChange(val as "out" | "in")}
                    className="w-full justify-center gap-4 rounded-full bg-muted/10 p-1 mb-4"
                  >
                    <ToggleGroupItem value="out" className="flex items-center gap-1 px-4 py-2 rounded-full data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                      <Minus className="h-4 w-4" /> Debit
                    </ToggleGroupItem>
                    <ToggleGroupItem value="in" className="flex items-center gap-1 px-4 py-2 rounded-full data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                      <Plus className="h-4 w-4" /> Credit
                    </ToggleGroupItem>
                  </ToggleGroup>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="account"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Account</FormLabel>
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
                name="effective_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className="w-full justify-start text-left font-normal"
                          >
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
            </div>

            <FormField
              control={form.control}
              name="raw_amount"
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

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Grocery Store Purchase" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Single category field */}
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
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
           
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Creating..." : "Create Transaction"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
