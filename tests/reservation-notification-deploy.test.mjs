import { test } from 'node:test'
import * as assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const mainSource = await readFile(new URL('../functions/reservation-notification/src/main.js', import.meta.url), 'utf8')
const deploySource = await readFile(new URL('../scripts/deploy-reservation-notification.mjs', import.meta.url), 'utf8')
const wrapperSource = await readFile(new URL('../functions/reservation-notification/shared/reservation-api/business.js', import.meta.url), 'utf8').catch(() => '')
const packageSource = await readFile(new URL('../package.json', import.meta.url), 'utf8')
const packageJson = JSON.parse(packageSource)

test('notification runtime imports the authoritative stored-order parser through its packaged wrapper', () => {
  assert.match(mainSource, /from '\.\.\/shared\/reservation-api\/business\.js'/)
  assert.match(wrapperSource, /reservation-api\/src\/business\.js/)
})

test('notification deploy archive replaces the local wrapper with every authoritative parser dependency', () => {
  assert.match(deploySource, /reservation-api\/src\/business\.js/)
  assert.match(deploySource, /reservation-api\/src\/coupon-digest\.js/)
  assert.match(deploySource, /reservation-api\/src\/active-cake-products\.js/)
  assert.match(deploySource, /shared\/reservation-api/)
  assert.match(deploySource, /cp\([^)]*recursive:\s*true/)
})

test('canonical npm test executes the notification deploy packaging regression', () => {
  assert.match(packageJson.scripts.test, /test:reservation-notification-deploy/)
  assert.match(packageJson.scripts['test:reservation-notification-deploy'], /reservation-notification-deploy\.test\.mjs/)
})
