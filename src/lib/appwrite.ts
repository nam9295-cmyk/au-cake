import { Account, Client, Databases, Functions, Storage } from 'appwrite'

const configuredEndpoint = import.meta.env.VITE_APPWRITE_ENDPOINT || import.meta.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || ''

function browserAppwriteEndpoint() {
  if (!configuredEndpoint || !import.meta.env.DEV || typeof window === 'undefined' || window.location.hostname === 'localhost') {
    return configuredEndpoint
  }

  try {
    const pathname = new URL(configuredEndpoint).pathname.replace(/\/$/, '')
    return `${window.location.origin}/appwrite${pathname}`
  } catch {
    return configuredEndpoint
  }
}

export const appwriteConfig = {
  endpoint: browserAppwriteEndpoint(),
  projectId: import.meta.env.VITE_APPWRITE_PROJECT_ID || import.meta.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || '',
  databaseId: import.meta.env.VITE_APPWRITE_CAKE_DATABASE_ID || import.meta.env.APPWRITE_CAKE_DATABASE_ID || '',
  classReservationsDatabaseId:
    import.meta.env.VITE_APPWRITE_KIDS_DATABASE_ID ||
    import.meta.env.APPWRITE_KIDS_DATABASE_ID ||
    import.meta.env.VITE_APPWRITE_CAKE_DATABASE_ID ||
    import.meta.env.APPWRITE_CAKE_DATABASE_ID ||
    '',
  reservationsCollectionId:
    import.meta.env.VITE_APPWRITE_CAKE_RESERVATIONS_TABLE_ID ||
    import.meta.env.APPWRITE_CAKE_RESERVATIONS_TABLE_ID ||
    'reservations',
  cakePickupOpeningsCollectionId:
    import.meta.env.VITE_APPWRITE_CAKE_PICKUP_OPENINGS_TABLE_ID ||
    import.meta.env.APPWRITE_CAKE_PICKUP_OPENINGS_TABLE_ID ||
    'cake_pickup_openings',
  settingsCollectionId:
    import.meta.env.VITE_APPWRITE_SETTINGS_TABLE_ID || import.meta.env.APPWRITE_SETTINGS_TABLE_ID || 'settings',
  classReservationsCollectionId:
    import.meta.env.VITE_APPWRITE_KIDS_RESERVATIONS_TABLE_ID ||
    import.meta.env.APPWRITE_KIDS_RESERVATIONS_TABLE_ID ||
    'class_reservations',
  classBookedDatesCollectionId:
    import.meta.env.VITE_APPWRITE_KIDS_BOOKED_DATES_TABLE_ID ||
    import.meta.env.APPWRITE_KIDS_BOOKED_DATES_TABLE_ID ||
    'class_booked_dates',
  reviewInvitesCollectionId:
    import.meta.env.VITE_APPWRITE_REVIEW_INVITES_TABLE_ID ||
    import.meta.env.APPWRITE_REVIEW_INVITES_TABLE_ID ||
    'review_invites',
  reviewsCollectionId:
    import.meta.env.VITE_APPWRITE_REVIEWS_TABLE_ID ||
    import.meta.env.APPWRITE_REVIEWS_TABLE_ID ||
    'reviews',
  reviewCouponsCollectionId:
    import.meta.env.VITE_APPWRITE_REVIEW_COUPONS_TABLE_ID ||
    import.meta.env.APPWRITE_REVIEW_COUPONS_TABLE_ID ||
    'review_coupons',
  reviewPhotoCleanupCollectionId:
    import.meta.env.VITE_APPWRITE_REVIEW_PHOTO_CLEANUP_TABLE_ID ||
    import.meta.env.APPWRITE_REVIEW_PHOTO_CLEANUP_TABLE_ID ||
    'review_photo_cleanup',
  reviewPhotosBucketId:
    import.meta.env.VITE_APPWRITE_REVIEW_PHOTOS_BUCKET_ID ||
    import.meta.env.APPWRITE_REVIEW_PHOTOS_BUCKET_ID ||
    'review-photos',
  reviewApiFunctionId: import.meta.env.VITE_REVIEW_API_FUNCTION_ID || '',
  reviewApiDirectUrl: import.meta.env.VITE_REVIEW_API_DIRECT_URL || '',
  reservationApiFunctionId: import.meta.env.VITE_RESERVATION_API_FUNCTION_ID || 'reservation-api',
  reservationApiMode: normalizeReservationApiMode(import.meta.env.VITE_RESERVATION_API_MODE),
  adminEmails: (import.meta.env.VITE_ADMIN_EMAILS || 'nam9295@gmail.com')
    .split(',')
    .map((email: string) => email.trim().toLowerCase())
    .filter(Boolean),
}

function normalizeReservationApiMode(value?: string): 'off' | 'lookup' | 'all' {
  if (value === 'lookup' || value === 'all') return value
  return 'off'
}

export const isAppwriteConfigured = Boolean(
  appwriteConfig.endpoint && appwriteConfig.projectId && appwriteConfig.databaseId,
)

const client = new Client()

if (isAppwriteConfigured) {
  client.setEndpoint(appwriteConfig.endpoint).setProject(appwriteConfig.projectId)
}

export const account = new Account(client)
export const databases = new Databases(client)
export const functions = new Functions(client)
export const storage = new Storage(client)
