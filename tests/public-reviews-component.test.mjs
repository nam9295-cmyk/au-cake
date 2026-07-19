import { test } from 'node:test'
import * as assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8')
const component = await readFile(new URL('../src/PublicReviewsSection.tsx', import.meta.url), 'utf8').catch(() => '')
const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8')

test('public review section is reusable, hidden when empty, and has no public review CTA', () => {
  assert.match(component, /export default function PublicReviewsSection/)
  assert.match(component, /if \(reviews\.length === 0\) return null/)
  assert.doesNotMatch(component, /Write a review/i)
  assert.match(component, /Incentivised review/)
  assert.match(component, /Verified order/)
  assert.match(component, /Verified class booking/)
})

test('home and classes place the showcase only in their public page flow', () => {
  const homeFaq = app.indexOf('className="content-section cake-faq-section"')
  const homeReviews = app.indexOf('<PublicReviewsSection', homeFaq)
  const pickup = app.indexOf('<PickupLocationCard', homeFaq)
  assert.ok(homeFaq < homeReviews && homeReviews < pickup)
  const classesStart = app.indexOf('function ClassesPage')
  const classesReviews = app.indexOf('<PublicReviewsSection', classesStart)
  const classesFinalCta = app.indexOf('className="kids-final-cta', classesStart)
  assert.ok(classesReviews < classesFinalCta)
  assert.equal((app.match(/<PublicReviewsSection/g) || []).length, 2)
})

test('review cards use desktop columns and mobile horizontal scroll snap without viewport overflow', () => {
  const sectionRule = css.match(/\.public-reviews-section\s*\{([^}]*)\}/)?.[1] || ''
  assert.match(sectionRule, /background:\s*#fff\s*;/)
  assert.match(css, /\.public-reviews-grid[\s\S]*grid-template-columns:\s*repeat\(3,/)
  assert.match(css, /@media \(max-width: 767px\)[\s\S]*\.public-reviews-grid[\s\S]*overflow-x:\s*auto/)
  assert.match(css, /scroll-snap-type:\s*x mandatory/)
  assert.match(css, /flex-basis:\s*84vw/)
})
