import test from 'node:test'
import assert from 'node:assert/strict'
import {access} from 'node:fs/promises'
import {getServiceSeoDefinitions} from '../scripts/services-seo.mjs'
test('static custom cake hub renders four menus with publicly resolvable photos',async()=>{
 const pages=await getServiceSeoDefinitions('https://example.test')
 const html=pages['/custom-cakes'].fallbackHtml
 assert.equal((html.match(/data-menu-id=/g)||[]).length,4)
 for(const [,photo] of html.matchAll(/<img[^>]*src="([^"]+)"/g)) await access('public'+photo)
 assert.match(html,/private-class&amp;tier=double/)
})
