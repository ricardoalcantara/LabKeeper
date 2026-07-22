import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react"

type InventoryTreeContextValue = {
  refreshKey: number
  bumpRefresh: () => void
}

const InventoryTreeContext = createContext<InventoryTreeContextValue | null>(null)

export function InventoryTreeProvider({ children }: { children: ReactNode }) {
  const [refreshKey, setRefreshKey] = useState(0)
  const bumpRefresh = useCallback(() => {
    setRefreshKey((value) => value + 1)
  }, [])
  const value = useMemo(() => ({ refreshKey, bumpRefresh }), [refreshKey, bumpRefresh])
  return <InventoryTreeContext.Provider value={value}>{children}</InventoryTreeContext.Provider>
}

export function useInventoryTree(): InventoryTreeContextValue {
  const ctx = useContext(InventoryTreeContext)
  if (!ctx) {
    throw new Error("useInventoryTree must be used within InventoryTreeProvider")
  }
  return ctx
}
