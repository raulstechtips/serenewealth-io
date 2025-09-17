"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { QueryClientProvider } from "@tanstack/react-query"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client"
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister"
import { queryClient } from "@/lib/query-client"

type Persister = ReturnType<typeof createAsyncStoragePersister>

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [persister, setPersister] = useState<Persister | null>(null)

  useEffect(() => {
    // Create persister only on client side
    if (typeof window !== 'undefined') {
      const asyncPersister = createAsyncStoragePersister({
        storage: window.localStorage,
        key: 'serenewealth-cache',
      })
      setPersister(asyncPersister)
    }
  }, [])

  // Render without persistence on server or before persister is ready
  if (!persister) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    )
  }

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        dehydrateOptions: {
          // Only persist reference data, not transactions
          shouldDehydrateQuery: (query) => {
            const queryKey = query.queryKey[0] as string
            return ['accounts', 'categories', 'category-groups'].includes(queryKey)
          },
        },
      }}
    >
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </PersistQueryClientProvider>
  )
}
