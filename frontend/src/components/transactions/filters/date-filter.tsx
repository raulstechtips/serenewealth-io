"use client"

import { useState } from "react"
import { CalendarIcon, ChevronDown, X } from "lucide-react"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { cn } from "@/lib/utils"

interface DateFilterProps {
  value: { from?: Date; to?: Date }
  onChange: (value: { from?: Date; to?: Date }) => void
}

const datePresets = [
  { label: "Last 7 days", days: 7 },
  { label: "Last 30 days", days: 30 },
  { label: "Last 90 days", days: 90 },
  { label: "This year", days: 365 },
]

export function DateFilter({ value, onChange }: DateFilterProps) {
  const [open, setOpen] = useState(false)
  const hasValue = value.from || value.to

  const getDateRangeText = () => {
    if (!value.from && !value.to) return "Date"
    if (value.from && value.to) {
      return `${format(value.from, "MMM d")} - ${format(value.to, "MMM d")}`
    }
    if (value.from) return `From ${format(value.from, "MMM d, yyyy")}`
    if (value.to) return `Until ${format(value.to, "MMM d, yyyy")}`
  }

  const applyPreset = (days: number) => {
    const to = new Date()
    const from = new Date()
    from.setDate(to.getDate() - days)
    onChange({ from, to })
    setOpen(false)
  }

  const clearFilter = () => {
    onChange({ from: undefined, to: undefined })
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "h-10 justify-between bg-background border-border/50 hover:bg-muted/50 transition-colors",
            hasValue && "border-primary/50 bg-primary/5"
          )}
        >
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
            <span className={cn(
              "text-sm",
              hasValue ? "text-foreground font-medium" : "text-muted-foreground"
            )}>
              {getDateRangeText()}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {hasValue && (
              <div
                onClick={(e) => {
                  e.stopPropagation()
                  clearFilter()
                }}
                className="h-5 w-5 flex items-center justify-center hover:bg-muted rounded cursor-pointer"
              >
                <X className="h-3 w-3" />
              </div>
            )}
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex">
          {/* Presets sidebar */}
          <div className="border-r border-border p-3 min-w-[140px]">
            <div className="text-sm font-medium mb-2">Quick select</div>
            <div className="space-y-1">
              {datePresets.map((preset) => (
                <Button
                  key={preset.label}
                  variant="ghost"
                  size="sm"
                  onClick={() => applyPreset(preset.days)}
                  className="w-full justify-start h-8 text-sm"
                >
                  {preset.label}
                </Button>
              ))}
              {hasValue && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilter}
                  className="w-full justify-start h-8 text-sm text-muted-foreground"
                >
                  Clear dates
                </Button>
              )}
            </div>
          </div>
          
          {/* Calendar */}
          <div className="p-3">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={value.from}
              selected={value.from && value.to ? { from: value.from, to: value.to } : undefined}
              onSelect={(range) => {
                onChange(range ?? { from: undefined, to: undefined })
                if (range?.from && range?.to) {
                  setOpen(false)
                }
              }}
              numberOfMonths={2}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
