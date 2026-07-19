export type Page =
  | 'home'
  | 'review'
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

export function getPageFromPath(path: string): Page {
  if (path === '/review' || path === '/review.html') return 'review'
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
    review: '/review',
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
