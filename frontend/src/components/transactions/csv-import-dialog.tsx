"use client"

import type React from "react"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"
import { Upload, FileText, CheckCircle } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { createTransaction } from "@/lib/api"
import { queryKeys } from "@/lib/query-client"
import type { Account } from "@/lib/types"

interface CSVImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  accounts: Account[]
}

type ImportStep = "upload" | "mapping" | "preview" | "complete"

interface CSVRow {
  [key: string]: string
}

interface MappedTransaction {
  date: string
  amount: number
  payee: string
  memo?: string
  isDuplicate?: boolean
}

const mappingSchema = z.object({
  accountId: z.string().min(1, "Account is required"),
  dateColumn: z.string().min(1, "Date column is required"),
  amountColumn: z.string().min(1, "Amount column is required"),
  payeeColumn: z.string().min(1, "Payee column is required"),
  memoColumn: z.string().optional(),
})

type MappingFormData = z.infer<typeof mappingSchema>

export function CSVImportDialog({ open, onOpenChange, accounts }: CSVImportDialogProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [step, setStep] = useState<ImportStep>("upload")
  const [csvData, setCsvData] = useState<CSVRow[]>([])
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [mappedTransactions, setMappedTransactions] = useState<MappedTransaction[]>([])
  const [importResults, setImportResults] = useState({ imported: 0, duplicates: 0, errors: 0 })

  const form = useForm<MappingFormData>({
    resolver: zodResolver(mappingSchema),
    defaultValues: {
      accountId: accounts.length > 0 ? accounts[0].id : "",
      dateColumn: "",
      amountColumn: "",
      payeeColumn: "",
      memoColumn: "",
    },
  })

  const importMutation = useMutation({
    mutationFn: async (transactions: MappedTransaction[]) => {
      const results = { imported: 0, duplicates: 0, errors: 0 }

      for (const transaction of transactions) {
        if (transaction.isDuplicate) {
          results.duplicates++
          continue
        }

        try {
          await createTransaction({
            accountId: form.getValues("accountId"),
            date: transaction.date,
            amount: transaction.amount,
            payee: transaction.payee,
            memo: transaction.memo,
            cleared: true,
          })
          results.imported++
        } catch (error) {
          results.errors++
        }
      }

      return results
    },
    onSuccess: (results) => {
      setImportResults(results)
      setStep("complete")
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions({}) })
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts })
    },
    onError: () => {
      toast({
        title: "Import failed",
        description: "There was an error importing your transactions.",
        variant: "destructive",
      })
    },
  })

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const lines = text.split("\n").filter((line) => line.trim())

      if (lines.length < 2) {
        toast({
          title: "Invalid CSV",
          description: "CSV file must have at least a header row and one data row.",
          variant: "destructive",
        })
        return
      }

      const headers = lines[0].split(",").map((h) => h.trim().replace(/"/g, ""))
      const data = lines.slice(1).map((line) => {
        const values = line.split(",").map((v) => v.trim().replace(/"/g, ""))
        const row: CSVRow = {}
        headers.forEach((header, index) => {
          row[header] = values[index] || ""
        })
        return row
      })

      setCsvHeaders(headers)
      setCsvData(data)
      setStep("mapping")
    }
    reader.readAsText(file)
  }

  const handleMapping = (data: MappingFormData) => {
    const transactions: MappedTransaction[] = csvData.map((row) => {
      const dateStr = row[data.dateColumn]
      const amountStr = row[data.amountColumn]
      const payee = row[data.payeeColumn]
      const memo = data.memoColumn ? row[data.memoColumn] : undefined

      // Parse date (assuming MM/DD/YYYY or similar format)
      const date = new Date(dateStr).toISOString()

      // Parse amount (handle negative values and currency symbols)
      const amount = Number.parseFloat(amountStr.replace(/[$,]/g, ""))

      return {
        date,
        amount,
        payee,
        memo,
        isDuplicate: false, // TODO: Implement duplicate detection
      }
    })

    setMappedTransactions(transactions)
    setStep("preview")
  }

  const handleImport = () => {
    importMutation.mutate(mappedTransactions)
  }

  const handleClose = () => {
    setStep("upload")
    setCsvData([])
    setCsvHeaders([])
    setMappedTransactions([])
    setImportResults({ imported: 0, duplicates: 0, errors: 0 })
    form.reset()
    onOpenChange(false)
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[800px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Transactions from CSV</DialogTitle>
          <DialogDescription>Upload a CSV file and map the columns to import your transactions.</DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
              <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
              <div className="mt-4">
                <Label htmlFor="csv-file" className="cursor-pointer">
                  <span className="text-sm font-medium">Choose CSV file</span>
                  <Input id="csv-file" type="file" accept=".csv" onChange={handleFileUpload} className="sr-only" />
                </Label>
                <p className="text-xs text-muted-foreground mt-2">
                  CSV files with headers for date, amount, payee, and memo columns
                </p>
              </div>
            </div>
          </div>
        )}

        {step === "mapping" && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Map CSV Columns
                </CardTitle>
                <CardDescription>
                  Map your CSV columns to transaction fields. Found {csvData.length} rows.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={form.handleSubmit(handleMapping)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Account</Label>
                      <Select
                        value={form.watch("accountId")}
                        onValueChange={(value) => form.setValue("accountId", value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select account" />
                        </SelectTrigger>
                        <SelectContent>
                          {accounts.map((account) => (
                            <SelectItem key={account.id} value={account.id}>
                              {account.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Date Column</Label>
                      <Select
                        value={form.watch("dateColumn")}
                        onValueChange={(value) => form.setValue("dateColumn", value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select date column" />
                        </SelectTrigger>
                        <SelectContent>
                          {csvHeaders.map((header) => (
                            <SelectItem key={header} value={header}>
                              {header}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Amount Column</Label>
                      <Select
                        value={form.watch("amountColumn")}
                        onValueChange={(value) => form.setValue("amountColumn", value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select amount column" />
                        </SelectTrigger>
                        <SelectContent>
                          {csvHeaders.map((header) => (
                            <SelectItem key={header} value={header}>
                              {header}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Payee Column</Label>
                      <Select
                        value={form.watch("payeeColumn")}
                        onValueChange={(value) => form.setValue("payeeColumn", value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select payee column" />
                        </SelectTrigger>
                        <SelectContent>
                          {csvHeaders.map((header) => (
                            <SelectItem key={header} value={header}>
                              {header}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2 col-span-2">
                      <Label>Memo Column (Optional)</Label>
                      <Select
                        value={form.watch("memoColumn")}
                        onValueChange={(value) => form.setValue("memoColumn", value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select memo column (optional)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">No memo column</SelectItem>
                          {csvHeaders.map((header) => (
                            <SelectItem key={header} value={header}>
                              {header}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setStep("upload")}>
                      Back
                    </Button>
                    <Button type="submit">Preview Import</Button>
                  </DialogFooter>
                </form>
              </CardContent>
            </Card>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5" />
                  Preview Import
                </CardTitle>
                <CardDescription>Review {mappedTransactions.length} transactions before importing.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="max-h-[400px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Payee</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Memo</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mappedTransactions.slice(0, 10).map((transaction, index) => (
                        <TableRow key={index}>
                          <TableCell>{new Date(transaction.date).toLocaleDateString()}</TableCell>
                          <TableCell>{transaction.payee}</TableCell>
                          <TableCell className={transaction.amount > 0 ? "text-green-600" : "text-red-600"}>
                            {formatCurrency(transaction.amount)}
                          </TableCell>
                          <TableCell>{transaction.memo || "-"}</TableCell>
                          <TableCell>
                            <Badge variant={transaction.isDuplicate ? "destructive" : "default"}>
                              {transaction.isDuplicate ? "Duplicate" : "New"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {mappedTransactions.length > 10 && (
                    <p className="text-sm text-muted-foreground text-center mt-2">
                      ... and {mappedTransactions.length - 10} more transactions
                    </p>
                  )}
                </div>

                <DialogFooter className="mt-4">
                  <Button type="button" variant="outline" onClick={() => setStep("mapping")}>
                    Back
                  </Button>
                  <Button onClick={handleImport} disabled={importMutation.isPending}>
                    {importMutation.isPending ? "Importing..." : "Import Transactions"}
                  </Button>
                </DialogFooter>
              </CardContent>
            </Card>
          </div>
        )}

        {step === "complete" && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  Import Complete
                </CardTitle>
                <CardDescription>Your transactions have been imported successfully.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-green-600">{importResults.imported}</div>
                    <div className="text-sm text-muted-foreground">Imported</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-orange-600">{importResults.duplicates}</div>
                    <div className="text-sm text-muted-foreground">Duplicates</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-red-600">{importResults.errors}</div>
                    <div className="text-sm text-muted-foreground">Errors</div>
                  </div>
                </div>

                <DialogFooter className="mt-6">
                  <Button onClick={handleClose}>Close</Button>
                </DialogFooter>
              </CardContent>
            </Card>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
