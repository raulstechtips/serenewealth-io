"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { useToast } from "@/hooks/use-toast"
import { useIsMobile } from "@/hooks/use-mobile"
import { createApiClient, APIError } from "@/api/client"
import { useAuthenticatedFetch } from "@/contexts/auth-context"

const accountSchema = z.object({
  name: z.string().min(1, "Account name is required"),
  type: z.enum(["ASSET", "LIABILITY"] as const),
  subtype: z.enum(["CHECKING", "SAVINGS", "CREDIT", "LOAN", "INVESTMENT"] as const),
  opening_balance: z.string()
    .refine((val) => {
      if (!val || val === "") return true
      const num = parseFloat(val)
      return !isNaN(num) && isFinite(num)
    }, "Opening balance must be a valid number")
})

type AccountFormData = z.infer<typeof accountSchema>

interface AddAccountDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAccountCreated?: () => void
}

export function AddAccountDialog({ open, onOpenChange, onAccountCreated }: AddAccountDialogProps) {
  const { toast } = useToast()
  const isMobile = useIsMobile()
  const authenticatedFetch = useAuthenticatedFetch()
  const apiClient = createApiClient(authenticatedFetch)
  const [isLoading, setIsLoading] = useState(false)

  const form = useForm<AccountFormData>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      name: "",
      type: "ASSET",
      subtype: "CHECKING",
      opening_balance: "0.00",
    },
  })

  const onSubmit = async (data: AccountFormData) => {
    try {
      setIsLoading(true)
      await apiClient.createAccount({
        name: data.name,
        type: data.type,
        subtype: data.subtype,
        currency: "USD",
        opening_balance: data.opening_balance,
      })
      
      toast({
        title: "Account created",
        description: "Your new account has been added successfully.",
      })
      
      form.reset()
      onOpenChange(false)
      onAccountCreated?.()
    } catch (error) {
      console.error('Error creating account:', error)
      toast({
        title: "Error",
        description: error instanceof APIError ? error.message : "Failed to create account. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Helper function to get subtypes for a specific type (matching account-filters.tsx logic)
  const getAvailableSubtypesForType = (type: "ASSET" | "LIABILITY") => {
    if (type === "ASSET") {
      return [
        { value: "CHECKING", label: "Checking" },
        { value: "SAVINGS", label: "Savings" },
        { value: "INVESTMENT", label: "Investment" },
      ]
    } else if (type === "LIABILITY") {
      return [
        { value: "CREDIT", label: "Credit Card" },
        { value: "LOAN", label: "Loan" },
      ]
    }
    return []
  }

  const selectedType = form.watch("type")
  const availableSubtypes = getAvailableSubtypesForType(selectedType)

  // Reset subtype when type changes if current subtype is not valid for new type
  const handleTypeChange = (newType: "ASSET" | "LIABILITY") => {
    const currentSubtype = form.getValues("subtype")
    const newAvailableSubtypes = getAvailableSubtypesForType(newType)
    
    // If current subtype is not available for the new type, reset to first available
    if (!newAvailableSubtypes.some(st => st.value === currentSubtype)) {
      form.setValue("subtype", newAvailableSubtypes[0]?.value as any)
    }
    
    form.setValue("type", newType)
  }

  const FormContent = () => (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Account Name</FormLabel>
              <FormControl>
                <Input
                  placeholder="e.g., Main Checking"
                  {...field}
                  className="text-base" // Larger text for mobile
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Account Category</FormLabel>
              <Select onValueChange={handleTypeChange} value={field.value}>
                <FormControl>
                  <SelectTrigger className="text-base">
                    {" "}
                    {/* Larger text for mobile */}
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="ASSET">Asset</SelectItem>
                  <SelectItem value="LIABILITY">Liability</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="subtype"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Account Type</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger className="text-base">
                    {" "}
                    {/* Larger text for mobile */}
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {availableSubtypes.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
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
          name="opening_balance"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Opening Balance</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  {...field}
                  className="text-base" // Larger text for mobile
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />


        {isMobile ? (
          <DrawerFooter className="px-0">
            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading ? "Creating..." : "Create Account"}
            </Button>
            <DrawerClose asChild>
              <Button variant="outline" className="w-full bg-transparent">
                Cancel
              </Button>
            </DrawerClose>
          </DrawerFooter>
        ) : (
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Creating..." : "Create Account"}
            </Button>
          </DialogFooter>
        )}
      </form>
    </Form>
  )

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader className="text-left">
            <DrawerTitle>Add New Account</DrawerTitle>
            <DrawerDescription>Create a new financial account to track your money.</DrawerDescription>
          </DrawerHeader>
          <div className="px-4">
            <FormContent />
          </div>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] max-w-[calc(100vw-2rem)]">
        <DialogHeader>
          <DialogTitle>Add New Account</DialogTitle>
          <DialogDescription>Create a new financial account to track your money.</DialogDescription>
        </DialogHeader>
        <FormContent />
      </DialogContent>
    </Dialog>
  )
}