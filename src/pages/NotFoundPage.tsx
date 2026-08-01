import type { Language } from '../lib/i18n.js'

export function NotFoundPage({ language }: { language: Language }) {
  return (
    <main className="not-found-page">
      <p className="summary-kicker">404</p>
      <h1>{language === 'ko' ? '페이지를 찾을 수 없어요' : 'Page not found'}</h1>
      <p>
        {language === 'ko'
          ? '요청한 주소가 없거나 더 이상 공개되지 않습니다.'
          : 'The requested address does not exist or is not published.'}
      </p>
      <a className="primary-button" href="/cakes">
        {language === 'ko' ? '케이크 보기' : 'Browse chocolate cakes'}
      </a>
    </main>
  )
}
