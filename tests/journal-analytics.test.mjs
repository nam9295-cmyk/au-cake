import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, mkdir, cp } from 'node:fs/promises'
import { join } from 'node:path'
import { runInNewContext } from 'node:vm'
import { parse } from 'parse5'
import { buildJournal } from '../scripts/journal-build.mjs'
import { prepareImport } from '../scripts/journal-import.mjs'
import { fixture } from './helpers/journal-fixture.mjs'

const origin = 'https://au.verygood-chocolate.com'
const approval = { approved: true, approvedBy: 'Test fixture only', approvedAt: '2026-01-01T00:00:00Z' }
const attr = (n,k) => n?.attrs?.find(a => a.name === k)?.value
const text = n => n.nodeName === '#text' ? n.value : (n.childNodes || []).map(text).join('')
function elements(html) {
  const found = []
  function walk(n) { if(n.tagName)found.push(n); for(const c of n.childNodes || [])walk(c) }
  walk(parse(html)); return found
}
async function publishedSite(t,{requireAnalytics=true}={}) {
  const f = await fixture(t, { status:'published', publishedAt:'2026-01-01T00:00:00Z', updatedAt:'2026-01-02T00:00:00Z', publication:approval })
  const sourceDirectory=join(f.root,'source'), outputDirectory=join(f.root,'output')
  await mkdir(sourceDirectory); await cp(f.inputDirectory,join(sourceDirectory,'one'),{recursive:true})
  await buildJournal({outputDirectory,sourceDirectory,market:'AU',siteUrl:origin})
  const html=await readFile(join(outputDirectory,'journal/sample-story.html'),'utf8'), nodes=elements(html)
  const script=nodes.find(n=>n.tagName==='script'&&attr(n,'src')?.startsWith('/journal-assets/analytics-'))
  if(requireAnalytics){assert.ok(script,'Journal analytics client is emitted');assert.ok(script.attrs.some(a=>a.name==='defer'),'analytics must not block article rendering')}
  return {...f,outputDirectory,html,nodes,code:script?await readFile(join(outputDirectory,attr(script,'src')),'utf8'):''}
}

// The platform boundary is simulated; the built client and shared analytics code run unchanged.
function browser(site,{consent=null,url=origin+'/journal/sample-story?email=private@example.com#source',storageBlocked=false,storageWriteBlocked=false}={}) {
  const values=new Map(consent===null?[]:[['vg-analytics-consent',consent]]),scripts=[]
  const bannerNode=site.nodes.find(n=>attr(n,'data-journal-analytics-consent')!==undefined)
  assert.ok(bannerNode,'readers entering directly can make the existing consent choice')
  const buttons=new Map(site.nodes.filter(n=>attr(n,'data-analytics-choice')).map(n=>{
    const button=new EventTarget(); button.dataset={analyticsChoice:attr(n,'data-analytics-choice')}; return [button.dataset.analyticsChoice,button]
  }))
  const banner={hidden:bannerNode.attrs.some(a=>a.name==='hidden'),querySelectorAll:()=>[...buttons.values()]}
  const document={
    title:text(site.nodes.find(n=>n.tagName==='title')),
    documentElement:{dataset:{},lang:attr(site.nodes.find(n=>n.tagName==='html'),'lang')},
    createElement:tag=>({tagName:tag.toUpperCase(),dataset:{}}),
    head:{appendChild:script=>scripts.push(script)},
    querySelector:selector=>selector==='[data-journal-analytics-consent]'?banner:selector==='link[rel="canonical"]'?{href:attr(site.nodes.find(n=>attr(n,'rel')==='canonical'),'href')}:scripts.find(s=>selector===`script[data-vg-ga="${s.dataset.vgGa}"]`),
  }
  const window={location:new URL(url),localStorage:{getItem:key=>{if(storageBlocked)throw Error('Storage disabled');return values.get(key)??null},setItem:(key,value)=>{if(storageWriteBlocked)throw Error('Storage write disabled');values.set(key,value)}}}
  const context={window,document,URL,console}
  const run=()=>runInNewContext(site.code,context)
  run()
  return {window,banner,values,scripts,run,choose:value=>buttons.get(value).dispatchEvent(new Event('click')),views:()=>JSON.parse(JSON.stringify((window.dataLayer||[]).map(args=>Array.from(args)).filter(args=>args[0]==='event'&&args[1]==='page_view')))}
}

test('Journal asks before analytics and preserves an essential-only choice across direct visits',async t=>{
  const site=await publishedSite(t),page=browser(site)
  assert.equal(page.banner.hidden,false);assert.equal(page.scripts.length,0);assert.deepEqual(page.views(),[])
  page.choose('denied')
  assert.equal(page.values.get('vg-analytics-consent'),'denied');assert.equal(page.banner.hidden,true);assert.equal(page.scripts.length,0)
  const next=browser(site,{consent:'denied'});assert.equal(next.banner.hidden,true);assert.equal(next.scripts.length,0);assert.deepEqual(next.views(),[])
})

test('allowing analytics sends one canonical page view using the configured property and no raw query/fragment',async t=>{
  const saved=process.env.VITE_GA_MEASUREMENT_ID
  process.env.VITE_GA_MEASUREMENT_ID='G-JOURNAL123'
  let site
  try{site=await publishedSite(t)}finally{if(saved===undefined)delete process.env.VITE_GA_MEASUREMENT_ID;else process.env.VITE_GA_MEASUREMENT_ID=saved}
  const page=browser(site);page.choose('granted');page.choose('granted');page.run()
  assert.equal(page.values.get('vg-analytics-consent'),'granted');assert.equal(page.banner.hidden,true)
  assert.equal(page.scripts.length,1);assert.equal(page.scripts[0].src,'https://www.googletagmanager.com/gtag/js?id=G-JOURNAL123')
  assert.deepEqual(page.views(),[['event','page_view',{page_location:origin+'/journal/sample-story',page_path:'/journal/sample-story',page_title:'Sample story | verygood'}]])
  const commands=(page.window.dataLayer||[]).map(args=>Array.from(args)),config=commands.find(args=>args[0]==='config')
  assert.equal(config[2].send_page_view,false);assert.equal(config[2].allow_google_signals,false);assert.equal(config[2].allow_ad_personalization_signals,false)
  assert.equal(commands.find(args=>args[0]==='consent'&&args[1]==='default')[2].analytics_storage,'denied')
  assert.equal(commands.find(args=>args[0]==='consent'&&args[1]==='update')[2].analytics_storage,'granted')
})

test('an existing website opt-in is reused and reload-independent bootstrap is idempotent',async t=>{
  const site=await publishedSite(t),page=browser(site,{consent:'granted'})
  page.run();assert.equal(page.banner.hidden,true);assert.equal(page.scripts.length,1);assert.equal(page.views().length,1)
})

test('alternate hosts and unavailable consent storage never contact Google',async t=>{
  const site=await publishedSite(t)
  for(const url of['http://127.0.0.1:4317/journal/sample-story','https://au-stage.verygood-chocolate.com/journal/sample-story','https://preview.au-cake-next.pages.dev/journal/sample-story']){
    const page=browser(site,{consent:'granted',url});assert.equal(page.scripts.length,0);assert.deepEqual(page.views(),[]);assert.equal(page.banner.hidden,true)
  }
  const page=browser(site,{storageBlocked:true});assert.equal(page.scripts.length,0);assert.deepEqual(page.views(),[]);assert.equal(page.banner.hidden,true)
})

test('private previews contain no analytics client or consent prompt',async t=>{
  const f=await fixture(t);await prepareImport({...f,expectedRevision:0})
  const outputDirectory=join(f.root,'preview');await buildJournal({outputDirectory,workspace:f.workspace,preview:true,market:'AU',siteUrl:origin})
  for(const file of['journal.html','journal/sample-story.html']){
    const nodes=elements(await readFile(join(outputDirectory,file),'utf8'))
    assert.equal(nodes.filter(n=>n.tagName==='script'&&attr(n,'src')).length,0)
    assert.equal(nodes.filter(n=>attr(n,'data-journal-analytics-consent')!==undefined).length,0)
  }
})

test('a blocked consent write fails closed without an uncaught button error',async t=>{
  const page=browser(await publishedSite(t),{storageWriteBlocked:true})
  page.choose('granted')
  await new Promise(resolve=>setImmediate(resolve))
  assert.equal(page.banner.hidden,true);assert.equal(page.scripts.length,0);assert.deepEqual(page.views(),[])
  assert.equal(page.values.has('vg-analytics-consent'),false)
})

test('Journal sitemap dates reflect the stored article update and never an arbitrary rebuild time',async t=>{
  const site=await publishedSite(t,{requireAnalytics:false}),xml=await readFile(join(site.outputDirectory,'sitemap.xml'),'utf8')
  const urls=new Map([...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map(m=>[m[1].match(/<loc>(.*?)<\/loc>/)?.[1],m[1].match(/<lastmod>(.*?)<\/lastmod>/)?.[1]]))
  assert.equal(urls.get(origin+'/journal/sample-story'),'2026-01-02T00:00:00Z')
  assert.equal(urls.get(origin+'/journal'),'2026-01-02T00:00:00Z')
})
