import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync,existsSync} from 'node:fs'
test('AU account/callback directly load private noindex artifacts and stay out of sitemap',()=>{
  if(process.env.VITE_MARKET==='KR') {assert.equal(existsSync('dist/account/index.html'),false);return}
  for(const path of ['account','account/auth/callback']) {
    assert.ok(existsSync(`dist/${path}/index.html`),`missing ${path} direct-load entry`)
    const html=readFileSync(`dist/${path}/index.html`,'utf8')
    assert.match(html,/<meta name="robots" content="noindex, nofollow"/)
    assert.match(html,/assets\//);assert.doesNotMatch(html,/customerUserId|customerEmail|secret=/)
  }
  assert.doesNotMatch(readFileSync('dist/sitemap.xml','utf8'),/\/account/)
  assert.ok(existsSync('dist/404.html'))
})
