import { marketConfig } from './lib/market'
import { RENEWAL_CART_KEY, subtractRenewalSubmission, addRenewalLines, removeRenewalLine, inspectRenewalCart, replaceRenewalLines, MOCHI_RESELECTION_KEY } from './lib/renewal-cart'
import { type RenewalSelection, priceRenewalOrder } from '../appwrite-functions/reservation-api/src/au-renewal.js'
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
  mochiReselectionRequired: boolean
  acknowledgeMochiReselection: () => void
  replaceRenewal: (id: string, lines: RenewalSelection[]) => void
  renewalLines: readonly RenewalSelection[]
  addRenewal: (lines: RenewalSelection[]) => void
  removeRenewal: (id: string) => void
  updateRenewal: (id: string, quantity: number) => void
  removeRenewalSubmitted: (lines:readonly RenewalSelection[]) => void
  clearRenewal: () => void
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
  const [initialRenewal] = useState(() => {
    if (marketConfig.market !== 'AU') return { lines: [] as RenewalSelection[], retiredMochi: [] as unknown[], acknowledged: true }
    try {
      const storage = getBrowserStorage()
      const inspected = inspectRenewalCart(storage?.getItem(RENEWAL_CART_KEY) || null)
      let archived = null
      try { archived = JSON.parse(storage?.getItem(MOCHI_RESELECTION_KEY) || 'null') } catch { /* invalid archive does not discard the active cart */ }
      const retiredMochi = [...(Array.isArray(archived?.lines) ? archived.lines : []), ...inspected.retiredMochi]
      return { ...inspected, retiredMochi, acknowledged: inspected.retiredMochi.length ? false : archived?.acknowledged === true }
    } catch { return { lines: [] as RenewalSelection[], retiredMochi: [] as unknown[], acknowledged: true } }
  })
  const [renewalLines, setRenewalLines] = useState<RenewalSelection[]>(initialRenewal.lines)
  const [mochiReselectionRequired, setMochiReselectionRequired] = useState(initialRenewal.retiredMochi.length > 0 && !initialRenewal.acknowledged)
  const acknowledgeMochiReselection = useCallback(() => setMochiReselectionRequired(false), [])
  useEffect(() => {
    if (marketConfig.market !== 'AU') return
    try {
      const storage = getBrowserStorage()
      // Archive retired local selections before replacing the active cart. No automatic conversion.
      if (initialRenewal.retiredMochi.length) storage?.setItem(MOCHI_RESELECTION_KEY, JSON.stringify({version:1,lines:initialRenewal.retiredMochi,acknowledged:!mochiReselectionRequired}))
      storage?.setItem(RENEWAL_CART_KEY, JSON.stringify({version:1,lines:renewalLines}))
    } catch { /* retain the original storage if archiving is unavailable */ }
  }, [renewalLines, initialRenewal, mochiReselectionRequired])
  const replaceRenewal = useCallback((id: string, incoming: RenewalSelection[]) => setRenewalLines(current => replaceRenewalLines(current, id, incoming)), [])
  const addRenewal = useCallback((incoming: RenewalSelection[]) => { setRenewalLines(current => addRenewalLines(current, incoming)) }, [])
  const removeRenewal = useCallback((id: string) => setRenewalLines(current => removeRenewalLine(current,id)), [])
  const updateRenewal = useCallback((id: string, quantity: number) => setRenewalLines(current => { const next=current.map(l=>l.lineId===id?{...l,quantity}:l);priceRenewalOrder(next,{localPreview:true});return next }), [])
  const removeRenewalSubmitted = useCallback((submitted:readonly RenewalSelection[]) => setRenewalLines(current=>subtractRenewalSubmission(current,submitted)),[])
  const clearRenewal = useCallback(() => setRenewalLines([]), [])
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
  const itemCount = useMemo(() => getCartTotalQuantity(lines) + renewalLines.reduce((n,l)=>n+l.quantity,0), [lines, renewalLines])
  const value = useMemo<CartContextValue>(() => ({
    mochiReselectionRequired, acknowledgeMochiReselection, replaceRenewal, renewalLines, addRenewal, removeRenewal, updateRenewal, clearRenewal, removeRenewalSubmitted,
    lines,
    itemCount,
    add,
    update,
    remove,
    removeSubmitted,
    clear,
  }), [lines, itemCount, add, update, remove, removeSubmitted, clear, mochiReselectionRequired, acknowledgeMochiReselection, replaceRenewal, renewalLines, addRenewal, removeRenewal, updateRenewal, clearRenewal, removeRenewalSubmitted])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCart() {
  const context = useContext(CartContext)
  if (!context) throw new Error('useCart must be used within CartProvider')
  return context
}
