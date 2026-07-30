export type Page =
  | 'home'
  | 'cart'
  | 'cakes'
  | 'cake-detail'
  | 'review'
  | 'reviews'
  | 'reserve'
  | 'complete'
  | 'lookup'
  | 'classes'
  | 'class-reserve'
  | 'class-complete'
  | 'admin-login'
  | 'admin'
  | 'admin-reservations'
  | 'admin-classes'
  | 'admin-reviews'
  | 'calendar'

export function getCakeSlugFromPath(path: string): string | null {
  const match = /^\/cakes\/([a-z0-9]+(?:-[a-z0-9]+)*)$/.exec(path)
  return match?.[1] || null
}

export function pathForCake(slug: string): string {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return '/cakes'
  return `/cakes/${slug}`
}

export function getPageFromPath(path: string): Page {
  if (path === '/cart') return 'cart'
  if (path === '/cakes') return 'cakes'
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
  if (path === '/admin/classes') return 'admin-classes'
  if (path === '/admin/reviews') return 'admin-reviews'
  if (path === '/admin') return 'admin'
  return 'home'
}

export function pathForPage(page: Page): string {
  const paths: Record<Page, string> = {
    home: '/',
    cart: '/cart',
    cakes: '/cakes',
    'cake-detail': '/cakes',
    review: '/review',
    reviews: '/reviews',
    reserve: '/reserve',
    complete: '/complete',
    lookup: '/lookup',
    classes: '/classes',
    'class-reserve': '/class-reserve',
    'class-complete': '/class-complete',
    'admin-login': '/admin/login',
    admin: '/admin',
    'admin-reservations': '/admin/reservations',
    'admin-classes': '/admin/classes',
    'admin-reviews': '/admin/reviews',
    calendar: '/calendar',
  }
  return paths[page]
}
