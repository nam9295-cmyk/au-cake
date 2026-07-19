import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import * as assert from 'node:assert/strict'

const pagePath = new URL('../src/ReviewPage.tsx', import.meta.url)
const cssPath = new URL('../src/index.css', import.meta.url)

test('review page wires accessible private photo selection and processing guards', async () => {
  const source = await readFile(pagePath, 'utf8')
  assert.match(source, /accept="image\/jpeg,image\/png,image\/webp,image\/heic,image\/heif"/)
  assert.match(source, /compressReviewPhoto/)
  assert.match(source, /uploadReviewPhoto/)
  assert.match(source, /removeReviewPhoto/)
  assert.match(source, /aria-live="polite"/)
  assert.match(source, /photoPublishConsent/)
  assert.match(source, /processingPhoto/)
  assert.match(source, /submittingRef/)
  assert.match(source, /photoOperationRef/)
  assert.match(source, /tryBeginReviewOperation\('photo'/)
  assert.match(source, /tryBeginReviewOperation\('submit'/)
  assert.match(source, /tabIndex=\{-1\}/)
  assert.match(source, /aria-hidden="true"/)
  assert.match(source, /disabled=\{submitting \|\| processingPhoto\}/)
  assert.doesNotMatch(source, /photoFileId/)
})

test('review photo and success transitions manage focus without focusing on initial load', async () => {
  const source = await readFile(pagePath, 'utf8')
  assert.match(source, /choosePhotoButtonRef/)
  assert.match(source, /photoStatusRef/)
  assert.match(source, /successHeadingRef/)
  assert.match(source, /successHeadingRef\.current\?\.focus\(\)/)
  assert.match(source, /photoStatusRef\.current\?\.focus\(\)/)
  assert.match(source, /choosePhotoButtonRef\.current\?\.focus\(\)/)
  assert.match(source, /role=\{photoErrorCode \? 'alert' : 'status'\}/)
})

test('photo card has mobile-safe preview and minimum 44px controls', async () => {
  const css = await readFile(cssPath, 'utf8')
  assert.match(css, /\.review-photo-card/)
  assert.match(css, /\.review-photo-preview/)
  assert.match(css, /\.review-photo-actions[\s\S]*min-height:\s*44px/)
  assert.match(css, /max-width:\s*100%/)
})
