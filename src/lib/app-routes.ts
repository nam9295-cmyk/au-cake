import { getCakeDetailBySlug } from './cake-detail.js'
import { getHogirlRouteFromPath } from '../stories/hogirl/routes.js'
import { getAuChocolatePreview } from './au-chocolate-preview.js'
import { marketConfig } from './market.js'

export { isHogirlPath } from '../stories/hogirl/routes.js'

export type Page =
  | 'home'
  | 'not-found'
  | 'cart'
  | 'cakes'
  | 'cake-detail'
  | 'chocolates'
  | 'chocolate-detail'
  | 'custom-cake'
  | 'custom-cake-complete'
  | 'review'
  | 'reviews'
  | 'reserve'
  | 'complete'
  | 'lookup'
  | 'classes'
  | 'class-reserve'
  | 'class-complete'
  | 'hogirl'
  | 'admin-login'
  | 'admin'
  | 'admin-reservations'
  | 'admin-custom-cakes'
  | 'admin-classes'
  | 'admin-reviews'
  | 'calendar'

export function getCakeSlugFromPath(path: string): string | null {
  const match = /^\/cakes\/([a-z0-9]+(?:-[a-z0-9]+)*)$/.exec(path)
  if (!match?.[1] || !getCakeDetailBySlug(match[1], 'en')) return null
  return match[1]
}

export function pathForCake(slug: string): string {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return '/cakes'
  return `/cakes/${slug}`
}

export function getChocolateSlugFromPath(path: string): string | null {
  const slug = /^\/chocolates\/([a-z0-9-]+)$/.exec(path)?.[1]
  return slug && getAuChocolatePreview(slug) ? slug : null
}

export function getPageFromPath(path: string): Page {
  if (getHogirlRouteFromPath(path)) return 'hogirl'
  if (path === '/') return 'home'
  if (path === '/cart') return 'cart'
  if (path === '/cakes') return 'cakes'
  if (path === '/chocolates' && marketConfig.market === 'AU') return 'chocolates'
  if (getChocolateSlugFromPath(path)) return 'chocolate-detail'
  if (path === '/cakes/custom-cake' || path === '/cakes/custom-cake/' || path === '/custom-cake') return 'custom-cake'
  if (path === '/custom-cake/complete') return 'custom-cake-complete'
  if (getCakeSlugFromPath(path)) return 'cake-detail'
  if (path === '/review' || path === '/review.html') return 'review'
  if (path === '/reviews') return 'reviews'
  if (path === '/calendar') return 'calendar'
  if (path === '/reserve') return 'reserve'
  if (path === '/complete') return 'complete'
  if (path === '/lookup') return 'lookup'
  if (path === '/classes') return 'classes'
  if (path === '/class-reserve') return 'class-reserve'
  if (path === '/class-complete') return 'class-complete'
  if (path === '/admin/login') return 'admin-login'
  if (path === '/admin/reservations') return 'admin-reservations'
  if (path === '/admin/custom-cakes') return 'admin-custom-cakes'
  if (path === '/admin/classes') return 'admin-classes'
  if (path === '/admin/reviews') return 'admin-reviews'
  if (path === '/admin') return 'admin'
  return 'not-found'
}

export function pathForPage(page: Page): string {
  const paths: Record<Page, string> = {
    home: '/',
    'not-found': '/404',
    cart: '/cart',
    cakes: '/cakes',
    'cake-detail': '/cakes',
    chocolates: '/chocolates',
    'chocolate-detail': '/chocolates',
    'custom-cake': '/cakes/custom-cake',
    'custom-cake-complete': '/custom-cake/complete',
    review: '/review',
    reviews: '/reviews',
    reserve: '/reserve',
    complete: '/complete',
    lookup: '/lookup',
    classes: '/classes',
    'class-reserve': '/class-reserve',
    'class-complete': '/class-complete',
    hogirl: '/stories/hogirl',
    'admin-login': '/admin/login',
    admin: '/admin',
    'admin-reservations': '/admin/reservations',
    'admin-custom-cakes': '/admin/custom-cakes',
    'admin-classes': '/admin/classes',
    'admin-reviews': '/admin/reviews',
    calendar: '/calendar',
  }
  return paths[page]
}
