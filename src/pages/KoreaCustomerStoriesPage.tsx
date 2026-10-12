import { useEffect, useMemo, useState } from 'react'
import { StoryCard, StoryDialog } from '../components/CustomerStories'
import { filterStories, type CustomerStory } from '../lib/customer-stories'
import { useAuLanguage } from '../lib/au-language'

export default function KoreaCustomerStoriesPage() {
  const { t } = useAuLanguage()
  const [stories, setStories] = useState<CustomerStory[]>([])
  const [error, setError] = useState(false)
  const [filters, setFilters] = useState({
    platform: '',
    photos: false,
    product: '',
    query: '',
  })
  const [limit, setLimit] = useState(12)
  const [selected, setSelected] = useState<CustomerStory | null>(null)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    fetch('/customer-stories/korea.json', { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw Error('Archive unavailable')
        return r.json()
      })
      .then((data) => {
        if (!controller.signal.aborted) {
          setStories(data.reviews)
          setError(false)
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true)
      })
    return () => controller.abort()
  }, [attempt])
  const visible = useMemo(
    () => filterStories(stories, filters),
    [stories, filters],
  )
  const products = useMemo(
    () =>
      Array.from(
        new Map(stories.flatMap((r) => r.products).map((p) => [p.id, p.label])),
      ),
    [stories],
  )
  const change = (next: Partial<typeof filters>) => {
    setFilters((f) => ({ ...f, ...next }))
    setLimit(12)
  }
  return (
    <main className="au-stories au-stories-archive">
      <header className="au-stories-archive-hero">
        <p className="au-stories-eyebrow">{t('KOREA STORE ARCHIVE · 2026', '한국 매장 후기 아카이브 · 2026')}</p>
        <h1>{t('FROM KOREA, WITH LOVE.', '한국에서 전해온 고객의 이야기.')}</h1>
        <p>
          {t('A collection of real customer experiences from Verygood Chocolate in Korea. Explore selected reviews and genuine customer photos from Baemin and Coupang Eats, with English translations where applicable.', '베리굿 초콜릿 한국 매장에서 고객들이 직접 남긴 경험입니다. 배달의민족과 쿠팡이츠에서 선별한 후기와 실제 고객 사진을 살펴보세요. 해당 후기에는 영어 번역도 제공됩니다.')}
        </p>
        <p className="au-stories-disclosure">
          {t('Selected reviews from our Korean store, not reviews of Australian orders. This selection contains positive five-star reviews; it is not an overall store rating. Mentions of promotions or extra items are preserved and incentive status has not been independently verified.', '한국 매장에서 선별한 후기이며, 호주 주문에 대한 후기가 아닙니다. 긍정적인 별점 5점 후기를 선정한 것으로 매장 전체 평점을 의미하지 않습니다. 프로모션이나 추가 제공품에 대한 고객 언급은 원문 그대로 보존했으며, 혜택 제공 여부는 별도로 검증하지 않았습니다.')}
        </p>
        <div className="au-stories-stats">
          {[
            [
              '293',
              t('Selected Customer Stories', '선정 고객 후기'),
              'Baemin 114 · Coupang Eats 179',
            ],
            ['255', t('Real Customer Photos', '실제 고객 사진'), t('From 215 photo reviews', '사진 후기 215건')],
            ['2', t('Review Platforms', '후기 플랫폼'), 'Baemin · Coupang Eats'],
            ['2026', t('Review Collection', '후기 수집 기간'), t('7 July – 7 October', '7월 7일 – 10월 7일')],
          ].map(([n, label, detail]) => (
            <div key={label}>
              <strong>{n}</strong>
              <span>{label}</span>
              <small>{detail}</small>
            </div>
          ))}
        </div>
      </header>
      <section
        className="au-stories-archive-body"
        aria-label="Explore customer stories"
      >
        <div className="au-stories-filters">
          <div className="au-stories-filter-buttons">
            <button
              type="button"
              aria-pressed={
                !filters.platform &&
                !filters.photos &&
                !filters.product &&
                !filters.query
              }
              onClick={() =>
                change({ platform: '', photos: false, product: '', query: '' })
              }
            >
              {t('All Stories (293)', '전체 후기 (293)')}
            </button>
            <button
              type="button"
              aria-pressed={filters.photos}
              onClick={() => change({ photos: !filters.photos })}
            >
              {t('With Photos (215)', '사진 후기 (215)')}
            </button>
            <button
              type="button"
              aria-pressed={filters.platform === 'baemin'}
              onClick={() =>
                change({
                  platform: filters.platform === 'baemin' ? '' : 'baemin',
                })
              }
            >
              Baemin (114)
            </button>
            <button
              type="button"
              aria-pressed={filters.platform === 'coupang'}
              onClick={() =>
                change({
                  platform: filters.platform === 'coupang' ? '' : 'coupang',
                })
              }
            >
              Coupang Eats (179)
            </button>
          </div>
          <div className="au-stories-search-row">
            <label>
              {t('Search reviews', '후기 검색')}
              <input
                type="search"
                value={filters.query}
                onChange={(e) => change({ query: e.target.value })}
                placeholder={t('Search by keyword, in English or Korean', '한국어 또는 영어 키워드로 검색')}
              />
            </label>
            <label>
              {t('Product mentioned', '언급된 제품')}
              <select
                aria-label={t('Product mentioned', '언급된 제품')}
                value={filters.product}
                onChange={(e) => change({ product: e.target.value })}
              >
                <option value="">{t('All product mentions', '모든 제품')}</option>
                {products.map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <span>{t('Newest first', '최신순')}</span>
          </div>
          <small>
            {t('Product filters use explicit mentions in the original review, not inferred purchase records.', '제품 필터는 후기 원문에 직접 언급된 내용을 기준으로 하며, 구매 기록을 추정한 것이 아닙니다.')}
          </small>
        </div>
        {error ? (
          <p role="alert">
            {t('We couldn’t load the archive.', '후기를 불러오지 못했습니다.')}{' '}
            <button type="button" onClick={() => setAttempt((a) => a + 1)}>
              {t('Try again', '다시 시도')}
            </button>
          </p>
        ) : !stories.length ? (
          <p role="status">{t('Loading customer stories…', '고객 후기를 불러오는 중…')}</p>
        ) : (
          <>
            <p className="au-stories-result-count" role="status">
              {t(`${visible.length} matching stories`, `검색 결과 ${visible.length}건`)}
            </p>
            <div className="au-stories-archive-grid">
              {visible.slice(0, limit).map((story) => (
                <StoryCard
                  key={story.id}
                  story={story}
                  onOpen={() => setSelected(story)}
                />
              ))}
            </div>
            {!visible.length && (
              <p>
                {t('No stories match these filters. Try another keyword or reset to All Stories.', '조건에 맞는 후기가 없습니다. 다른 키워드를 입력하거나 전체 후기로 돌아가세요.')}
              </p>
            )}
            <div className="au-stories-load">
              <p>
                {t(`Showing ${Math.min(limit, visible.length)} of ${visible.length} stories`, `전체 ${visible.length}건 중 ${Math.min(limit, visible.length)}건 표시`)}
              </p>
              {limit < visible.length && (
                <button type="button" onClick={() => setLimit((n) => n + 12)}>
                  {t(`LOAD MORE STORIES (${visible.length - limit} REMAINING)`, `후기 더 보기 (${visible.length - limit}건 남음)`)}
                </button>
              )}
            </div>
          </>
        )}
      </section>
      <section className="au-stories-bridge">
        <p className="au-stories-eyebrow">VERYGOOD · SYDNEY</p>
        <h2>{t('FIND SOMETHING TO SHARE.', '함께 나눌 디저트를 찾아보세요.')}</h2>
        <p>{t('Explore our current Sydney cake and chocolate collection.', '현재 시드니에서 선보이는 케이크와 초콜릿 컬렉션을 만나보세요.')}</p>
        <a href="/cakes">{t('EXPLORE SYDNEY CAKES', '시드니 케이크 보기')}</a>
        <a href="/business/events">{t('CORPORATE & EVENT ENQUIRIES', '기업 행사 및 이벤트 문의')}</a>
      </section>
      <StoryDialog
        key={selected?.id ?? 'closed'}
        story={selected}
        onClose={() => setSelected(null)}
      />
    </main>
  )
}
