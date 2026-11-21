import { isRenewalBagPath, normalizeAuShopPath } from '../lib/app-routes'
import { DEFAULT_SETTINGS } from '../lib/constants'
import type { StoreSettings } from '../lib/types'
import AuRenewalBag from './AuRenewalBag'
import AuRenewalCatalog from './AuRenewalCatalog'

export { RenewalCollection } from './AuRenewalCatalog'

export function AuRenewalShop({ path, settings = DEFAULT_SETTINGS }: { path: string; settings?: StoreSettings }) {
  const route = normalizeAuShopPath(path)
  return isRenewalBagPath(route)
    ? <AuRenewalBag settings={settings} />
    : <AuRenewalCatalog path={route} />
}
