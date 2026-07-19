import { test } from 'node:test'
import * as assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8')
const page = await readFile(new URL('../src/AdminReviewsPage.tsx', import.meta.url), 'utf8').catch(() => '')
const photoPreview = await readFile(new URL('../src/lib/admin-review-photo-preview.ts', import.meta.url), 'utf8').catch(() => '')
const frame = await readFile(new URL('../src/AdminFrame.tsx', import.meta.url), 'utf8').catch(() => '')
const routes = await readFile(new URL('../src/lib/app-routes.ts', import.meta.url), 'utf8')
const seo = await readFile(new URL('../src/lib/seo.ts', import.meta.url), 'utf8')
const generator = await readFile(new URL('../scripts/generate-seo-pages.mjs', import.meta.url), 'utf8')
const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8')

test('admin reviews route uses the existing admin auth guard and shell navigation', () => {
  assert.match(routes, /'admin-reviews'/)
  assert.match(routes, /path === '\/admin\/reviews'/)
  assert.match(app, /page === 'admin-reviews'/)
  assert.match(app, /<AdminReviewsPage/)
  assert.match(frame, /리뷰 관리/)
  assert.match(page, /isAdminLoggedIn\(\)/)
  assert.match(page, /navigate\('admin-login'\)/)
  assert.match(page, /<AdminFrame/)
})

test('admin reviews route is noindex in runtime and generated static SEO pages', () => {
  assert.match(seo, /'\/admin\/reviews'[\s\S]*noindex:\s*true/)
  assert.match(generator, /'\/admin\/reviews'[\s\S]*robots:\s*'noindex, nofollow'/)
})

test('moderation UI exposes three filters, consent-safe actions, status announcements, and no positivity censorship', () => {
  for (const label of ['대기', '게시', '숨김']) assert.match(page, new RegExp(label))
  assert.match(page, /게시 동의가 없어 게시할 수 없습니다/)
  assert.match(page, /사진 공개 동의가 없으면 글만 공개됩니다/)
  assert.match(page, /부정적인 후기라는 이유로 숨기지 않습니다/)
  assert.match(page, /개인정보, 스팸, 부적절한 사진/)
  assert.match(page, /aria-live="polite"/)
  assert.match(page, /aria-busy=/)
  assert.match(page, /disabled=/)
  assert.match(page, /더 보기/)
})

test('admin review cards use a private JWT-backed photo preview without file identifiers or public URLs', () => {
  for (const marker of ['sourceType', 'rating', 'body', 'displayName', 'createdAt', 'rewardPercent', 'publishConsent', 'photoPublishConsent', 'hasPhoto', 'moderationStatus']) {
    assert.match(page, new RegExp(`review\\.${marker}`))
  }
  assert.match(page, /<AdminReviewPhotoPreview/)
  assert.match(page, /reviewApiDirectUrl/)
  assert.match(photoPreview, /account\.createJWT\(\)/)
  assert.match(photoPreview, /credentials:\s*'omit'/)
  assert.match(photoPreview, /referrerPolicy:\s*'no-referrer'/)
  assert.doesNotMatch(page, /Private photo preview available after Review API rollout/)
  assert.match(page, /src="\/demo-review-cake\.webp"/)
  assert.match(page, /운영 Storage에서 불러온 사진이 아닙니다/)
  for (const forbidden of ['phone', 'email', 'childName', 'sourceReservationId', 'sourceReservationNumber', 'couponCode', 'couponHash', 'couponLast4', 'inviteToken', 'tokenHash', 'photoFileId']) {
    assert.doesNotMatch(page, new RegExp(`review\\.${forbidden}`))
  }
})

test('filter and load-more controls are locked while moderation is pending and completion refetches the live filter generation', () => {
  assert.match(page, /disabled=\{loading \|\| actionIds\.size > 0\}/)
  assert.match(page, /filterRef\.current/)
  assert.match(page, /moderationCompletionPlan/)
  assert.match(page, /load\(undefined,\s*plan\.refetchFilter/)
})

test('demo moderation is visibly labelled not saved and remains development gated', () => {
  assert.match(app, /import\.meta\.env\.DEV\s*&&\s*import\.meta\.env\.VITE_REVIEW_DEMO_MODE === 'true'/)
  assert.match(page, /DEMO/)
  assert.match(page, /저장되지 않음/)
})

test('admin review controls remain mobile-safe at 320 through 390 widths with 44px targets', () => {
  assert.match(css, /\.admin-review-controls[\s\S]*min-height:\s*44px/)
  assert.match(css, /\.admin-review-action[\s\S]*min-height:\s*44px/)
  assert.match(css, /@media \(max-width: 767px\)[\s\S]*\.admin-reviews-page/)
  assert.match(css, /overflow-wrap:\s*anywhere/)
})
