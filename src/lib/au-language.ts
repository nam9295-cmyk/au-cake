import { createContext, useContext } from 'react'
import type { Language } from './i18n'

export const AuLanguageContext = createContext<{
  language: Language
  setLanguage: (language: Language) => void
}>({ language: 'en', setLanguage() {} })

export function useAuLanguage() {
  const context = useContext(AuLanguageContext)
  return { ...context, t: (english: string, korean: string) => context.language === 'ko' ? korean : english }
}
