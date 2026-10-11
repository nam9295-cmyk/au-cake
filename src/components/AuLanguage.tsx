import type { ReactNode } from 'react'
import type { Language } from '../lib/i18n'
import { AuLanguageContext, useAuLanguage } from '../lib/au-language'

export function AuLanguageProvider({ language, setLanguage, children }: {
  language: Language
  setLanguage: (language: Language) => void
  children: ReactNode
}) {
  return <AuLanguageContext.Provider value={{ language, setLanguage }}>{children}</AuLanguageContext.Provider>
}

export function AuLanguageToggle() {
  const { language, setLanguage } = useAuLanguage()
  return <div className="au-language-control">
    <div className="au-language-options" role="group" aria-label="Language / 언어">
      <button type="button" lang="en" aria-pressed={language === 'en'} onClick={() => setLanguage('en')}>EN</button>
      <span aria-hidden="true">/</span>
      <button type="button" lang="ko" aria-pressed={language === 'ko'} onClick={() => setLanguage('ko')}>한국어</button>
    </div>
    <button className="au-language-compact" type="button"
      lang={language === 'en' ? 'ko' : 'en'}
      aria-label={language === 'en' ? 'View in Korean / 한국어로 보기' : 'View in English / 영어로 보기'}
      onClick={() => setLanguage(language === 'en' ? 'ko' : 'en')}>
      {language === 'en' ? '한국어' : 'EN'}
    </button>
  </div>
}
