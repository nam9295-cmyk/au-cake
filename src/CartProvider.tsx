import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react'
import {
  addCartLine,
  getCartTotalQuantity,
  loadCartLines,
  removeCartLine,
  saveCartLines,
  subtractSubmittedCartLines,
  updateCartLineQuantity,
  type CartLine,
  type StorageLike,
} from './lib/cart'
import type { CakeDetailSelection } from './lib/cake-detail'

type CartContextValue = {
  lines: readonly CartLine[]
  itemCount: number
  add: (selection: CakeDetailSelection) => void
  update: (lineKey: string, quantity: number) => void
  remove: (lineKey: string) => void
  removeSubmitted: (submitted: readonly CartLine[]) => void
  clear: () => void
}

const CartContext = createContext<CartContextValue | null>(null)

function getBrowserStorage(): StorageLike | null {
  if (typeof window === 'undefined') return null

  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function CartProvider({ children }: PropsWithChildren) {
  const [lines, setLines] = useState<CartLine[]>(() => {
    const storage = getBrowserStorage()
    return storage ? loadCartLines(storage) : []
  })

  useEffect(() => {
    const storage = getBrowserStorage()
    if (storage) saveCartLines(storage, lines)
  }, [lines])

  const add = useCallback((selection: CakeDetailSelection) => {
    setLines((current) => addCartLine(current, selection))
  }, [])

  const update = useCallback((lineKey: string, quantity: number) => {
    setLines((current) => updateCartLineQuantity(current, lineKey, quantity))
  }, [])

  const remove = useCallback((lineKey: string) => {
    setLines((current) => removeCartLine(current, lineKey))
  }, [])

  const removeSubmitted = useCallback((submitted: readonly CartLine[]) => {
    setLines((current) => subtractSubmittedCartLines(current, submitted))
  }, [])

  const clear = useCallback(() => setLines([]), [])
  const itemCount = useMemo(() => getCartTotalQuantity(lines), [lines])
  const value = useMemo<CartContextValue>(() => ({
    lines,
    itemCount,
    add,
    update,
    remove,
    removeSubmitted,
    clear,
  }), [lines, itemCount, add, update, remove, removeSubmitted, clear])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCart() {
  const context = useContext(CartContext)
  if (!context) throw new Error('useCart must be used within CartProvider')
  return context
}
