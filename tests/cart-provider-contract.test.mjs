import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const readSource = async (path) => readFile(new URL(path, import.meta.url), 'utf8').catch(() => '')

const providerSource = await readSource('../src/CartProvider.tsx')
const cartSource = await readSource('../src/lib/cart.ts')
const mainSource = await readSource('../src/main.tsx')

test('CartProvider owns the cart context and exposes the complete phase A API', () => {
  assert.match(providerSource, /createContext<[^>]*CartContextValue[^>]*>/)
  assert.match(providerSource, /export function CartProvider\b/)
  assert.match(providerSource, /export function useCart\b/)

  for (const member of ['lines', 'itemCount', 'add', 'update', 'remove', 'clear']) {
    assert.match(providerSource, new RegExp(`\\b${member}\\b`), member)
  }

  assert.match(providerSource, /useCallback/)
  assert.match(providerSource, /useMemo/)
  assert.doesNotMatch(providerSource, /from ['"]\.\/App/)
})

test('CartProvider keeps the hook export with a narrow Fast Refresh lint exception', () => {
  assert.match(
    providerSource,
    /\/\/ eslint-disable-next-line react-refresh\/only-export-components\s+export function useCart\b/,
  )
})

test('CartProvider lazily loads and safely persists with the shared storage helpers', () => {
  assert.match(cartSource, /CART_STORAGE_KEY/)
  assert.match(cartSource, /storage\.getItem\(CART_STORAGE_KEY\)/)
  assert.match(cartSource, /storage\.setItem\(CART_STORAGE_KEY, serializeCartLines\(lines\)\)/)
  assert.match(providerSource, /loadCartLines/)
  assert.match(providerSource, /saveCartLines/)
  assert.match(providerSource, /useState<CartLine\[]>\(\(\) =>/)
  assert.match(providerSource, /typeof window === ['"]undefined['"]/)
  assert.match(providerSource, /window\.localStorage/)
  assert.match(providerSource, /useEffect/)
})

test('main wraps the single App instance with CartProvider', () => {
  assert.match(mainSource, /import \{ CartProvider \} from ['"]\.\/CartProvider['"]/)
  assert.equal((mainSource.match(/<CartProvider>/g) || []).length, 1)
  assert.equal((mainSource.match(/<\/CartProvider>/g) || []).length, 1)
  assert.equal((mainSource.match(/<App \/>/g) || []).length, 1)
  assert.match(mainSource, /<CartProvider>[\s\S]*<App \/>[\s\S]*<\/CartProvider>/)
})
