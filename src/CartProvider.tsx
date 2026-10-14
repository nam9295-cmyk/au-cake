import { marketConfig } from './lib/market'
import { RENEWAL_CART_KEY, subtractRenewalSubmission, addRenewalLines, removeRenewalLine, parseRenewalCart } from './lib/renewal-cart'
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
  const [renewalLines, setRenewalLines] = useState<RenewalSelection[]>(() => { if(marketConfig.market!=='AU')return [];try{return parseRenewalCart(getBrowserStorage()?.getItem(RENEWAL_CART_KEY)||null)}catch{return []} })
  useEffect(() => { if(marketConfig.market!=='AU')return;try { getBrowserStorage()?.setItem(RENEWAL_CART_KEY, JSON.stringify({version:1,lines:renewalLines})) } catch { /* preserve in-memory cart */ } }, [renewalLines])
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
    renewalLines, addRenewal, removeRenewal, updateRenewal, clearRenewal, removeRenewalSubmitted,
    lines,
    itemCount,
    add,
    update,
    remove,
    removeSubmitted,
    clear,
  }), [lines, itemCount, add, update, remove, removeSubmitted, clear, renewalLines, addRenewal, removeRenewal, updateRenewal, clearRenewal, removeRenewalSubmitted])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCart() {
  const context = useContext(CartContext)
  if (!context) throw new Error('useCart must be used within CartProvider')
  return context
}
