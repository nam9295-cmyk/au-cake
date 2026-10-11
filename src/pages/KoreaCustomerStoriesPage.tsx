import { useEffect, useMemo, useState } from 'react'
import { StoryCard, StoryDialog } from '../components/CustomerStories'
import { filterStories, type CustomerStory } from '../lib/customer-stories'

export default function KoreaCustomerStoriesPage() {
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
        <p className="au-stories-eyebrow">KOREA STORE ARCHIVE · 2026</p>
        <h1>FROM KOREA, WITH LOVE.</h1>
        <p>
          A collection of real customer experiences from Verygood Chocolate in
          Korea. Explore selected reviews and genuine customer photos from
          Baemin and Coupang Eats, with English translations where applicable.
        </p>
        <p className="au-stories-disclosure">
          Selected reviews from our Korean store, not reviews of Australian
          orders. This selection contains positive five-star reviews; it is not
          an overall store rating. Mentions of promotions or extra items are
          preserved and incentive status has not been independently verified.
        </p>
        <div className="au-stories-stats">
          {[
            [
              '293',
              'Selected Customer Stories',
              'Baemin 114 · Coupang Eats 179',
            ],
            ['255', 'Real Customer Photos', 'From 215 photo reviews'],
            ['2', 'Review Platforms', 'Baemin · Coupang Eats'],
            ['2026', 'Review Collection', '7 July – 7 October'],
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
              All Stories (293)
            </button>
            <button
              type="button"
              aria-pressed={filters.photos}
              onClick={() => change({ photos: !filters.photos })}
            >
              With Photos (215)
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
              Search reviews
              <input
                type="search"
                value={filters.query}
                onChange={(e) => change({ query: e.target.value })}
                placeholder="Search by keyword, in English or Korean"
              />
            </label>
            <label>
              Product mentioned
              <select
                aria-label="Product mentioned"
                value={filters.product}
                onChange={(e) => change({ product: e.target.value })}
              >
                <option value="">All product mentions</option>
                {products.map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <span>Newest first</span>
          </div>
          <small>
            Product filters use explicit mentions in the original review, not
            inferred purchase records.
          </small>
        </div>
        {error ? (
          <p role="alert">
            We couldn’t load the archive.{' '}
            <button type="button" onClick={() => setAttempt((a) => a + 1)}>
              Try again
            </button>
          </p>
        ) : !stories.length ? (
          <p role="status">Loading customer stories…</p>
        ) : (
          <>
            <p className="au-stories-result-count" role="status">
              {visible.length} matching stories
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
                No stories match these filters. Try another keyword or reset to
                All Stories.
              </p>
            )}
            <div className="au-stories-load">
              <p>
                Showing {Math.min(limit, visible.length)} of {visible.length}{' '}
                stories
              </p>
              {limit < visible.length && (
                <button type="button" onClick={() => setLimit((n) => n + 12)}>
                  LOAD MORE STORIES ({visible.length - limit} REMAINING)
                </button>
              )}
            </div>
          </>
        )}
      </section>
      <section className="au-stories-bridge">
        <p className="au-stories-eyebrow">VERYGOOD · SYDNEY</p>
        <h2>FIND SOMETHING TO SHARE.</h2>
        <p>Explore our current Sydney cake and chocolate collection.</p>
        <a href="/cakes">EXPLORE SYDNEY CAKES</a>
        <a href="/business/events">CORPORATE & EVENT ENQUIRIES</a>
      </section>
      <StoryDialog
        key={selected?.id ?? 'closed'}
        story={selected}
        onClose={() => setSelected(null)}
      />
    </main>
  )
}
