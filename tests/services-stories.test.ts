import test from 'node:test'
import assert from 'node:assert/strict'
import {
  filterStories,
  type CustomerStory,
} from '../src/lib/customer-stories.js'
import { getPageFromPath } from '../src/lib/app-routes.js'
import { getSeoConfig } from '../src/lib/seo.js'
import { marketConfig } from '../src/lib/market.js'
import featured from '../src/content/customer-stories-featured.json' with { type: 'json' }
import routes from '../src/content/au-service-routes.json' with { type: 'json' }

test('new routes and canonicals are AU only; Custom Cake aliases remain intact', () => {
  for (const route of routes) {
    assert.equal(
      getPageFromPath(route.path),
      marketConfig.market === 'AU'
        ? route.path.startsWith('/business/')
          ? 'business'
          : 'customer-stories'
        : 'not-found',
    )
    if (marketConfig.market === 'AU')
      assert.equal(
        getSeoConfig(route.path).canonical,
        `https://au.verygood-chocolate.com${route.path}`,
      )
  }
  for (const path of [
    '/cakes/custom-cake',
    '/cakes/custom-cake/',
    '/custom-cake',
  ])
    assert.equal(getPageFromPath(path), 'custom-cake')
  assert.equal(getPageFromPath('/custom-cake/complete'), 'custom-cake-complete')
  assert.equal(getPageFromPath('/reviews'), 'reviews')
  assert.equal(getPageFromPath('/classes'), 'classes')
})
test('combined story filters search both languages and preserve newest-first ordering', () => {
  const stories: CustomerStory[] = featured
  const defaults = { platform: '', photos: false, product: '', query: '' }
  assert.equal(
    filterStories(stories, { ...defaults, platform: 'baemin' }).length,
    2,
  )
  assert.equal(filterStories(stories, { ...defaults, query: '꾸덕' }).length, 2)
  assert.equal(
    filterStories(stories, {
      ...defaults,
      platform: 'coupang',
      photos: true,
      query: 'Sunday',
    })[0].id,
    'CE0035',
  )
  assert.equal(
    filterStories(stories, { ...defaults, product: 'cupcake' }).length,
    0,
  )
  assert.equal(
    filterStories(stories, { ...defaults, query: 'not-a-matching-review' })
      .length,
    0,
  )
  assert.equal(filterStories(stories, defaults)[0].id, 'CE0035')
})
