import { Account, Client, Databases } from 'appwrite'

export const appwriteConfig = {
  endpoint: import.meta.env.VITE_APPWRITE_ENDPOINT || import.meta.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || '',
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
  settingsCollectionId:
    import.meta.env.VITE_APPWRITE_SETTINGS_TABLE_ID || import.meta.env.APPWRITE_SETTINGS_TABLE_ID || 'settings',
  classReservationsCollectionId:
    import.meta.env.VITE_APPWRITE_KIDS_RESERVATIONS_TABLE_ID ||
    import.meta.env.APPWRITE_KIDS_RESERVATIONS_TABLE_ID ||
    'class_reservations',
  adminEmails: (import.meta.env.VITE_ADMIN_EMAILS || 'nam9295@gmail.com')
    .split(',')
    .map((email: string) => email.trim().toLowerCase())
    .filter(Boolean),
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
