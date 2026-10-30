import test from 'node:test'
import assert from 'node:assert/strict'
import { parse } from 'parse5'
import { normalizeFigcraftExports } from '../scripts/journal-figcraft.mjs'

const hash = 'a'.repeat(64)
function frame(width, prefix, fontSize, imageHeight) {
  const text = (id, name, characters) => ({ id, name, type:'TEXT', characters })
  const tree = { id:width, type:'FRAME', name:prefix, children:[
    text(1,'H1 Title','Example story'),
    { id:2, type:'FRAME', name:'Copy', children:[text(3,'H2 Section','A section'),text(4,'Paragraph','Keep this text.[1]')] },
    { id:5, type:'FRAME', name:'Photo', fills:[{type:'image',image:hash,scale_mode:'fill',filters:{}}] },
    text(6,'CTA Link','Explore cakes'),
    text(7,'Source [1]','[1] https://example.com/source — Source'),
  ] }
  const code = `<div class="${prefix}"><p class="${prefix}-title">Example story</p><div class="${prefix}-copy"><p class="${prefix}-section">A section</p><p class="${prefix}-text">Keep this text.[1]</p></div><div class="${prefix}-photo"></div><p class="${prefix}-cta">Explore cakes</p><p class="${prefix}-source">[1] https://example.com/source — Source</p></div><style>.${prefix}{width:${width}px;display:flex;flex-direction:column;padding:20px;gap:24px}.${prefix}-title{width:${width-40}px;font-size:${fontSize}px}.${prefix}-copy{width:${width-40}px;display:flex;gap:20px}.${prefix}-section{font-size:24px}.${prefix}-photo{width:${width-40}px;height:${imageHeight}px;background:url(image.png) center / cover}</style>`
  return { width, tree, code }
}
function input() {
  return { entry:{ id:'example',slug:'example',title:'Example story',excerpt:'Example description',locale:'en-AU',status:'draft',cover:{layer:5,alt:'An approved example photograph'},figcraft:{imageAlt:{5:'An approved example photograph'},links:{6:'/cakes'}} }, desktop:frame(1440,'desktop',44,520), variants:[{maxWidth:600,...frame(390,'mobile',30,240)}], images:new Map([[hash,Buffer.from('test image bytes')]]),version:'0.12.1' }
}

function elements(html) {
  const found=[];function walk(n){if(n.tagName)found.push(n);for(const c of n.childNodes||[])walk(c)}walk(parse(html));return found
}

test('native FigCraft export becomes one semantic DOM with real photos, links and source provenance', () => {
  const result = normalizeFigcraftExports(input())
  const nodes = elements(result.html)
  assert.equal(nodes.filter(n=>n.tagName==='h1').length,1)
  assert.equal(nodes.filter(n=>n.tagName==='h2').length,1)
  const img=nodes.find(n=>n.tagName==='img')
  assert.equal(img.attrs.find(a=>a.name==='src').value,`assets/${hash}.png`)
  assert.equal(img.attrs.find(a=>a.name==='alt').value,'An approved example photograph')
  assert.match(result.html,/href="\/cakes"/)
  assert.match(result.html,/href="#source-1"/)
  assert.match(result.html,/href="https:\/\/example.com\/source"/)
  assert.equal(result.entry.source.tool,'figcraft')
  assert.equal(result.entry.cover.src,`assets/${hash}.png`)
  assert.doesNotMatch(result.css,/image\.png/)
  assert.equal(result.files.length,1)
})

test('mobile layout maps to the same text and image layers without duplicate article text', () => {
  const result=normalizeFigcraftExports(input())
  assert.match(result.css,/@media\s*\(max-width:\s*600px\)/)
  assert.match(result.css,/font-size:\s*30px/)
  assert.match(result.css,/height:\s*240px/)
  assert.match(result.css,/width:\s*min\(100%,\s*390px\)/)
  assert.equal((result.html.match(/Keep this text/g)||[]).length,1)
})

test('missing image data or alt never silently publishes an empty photo', () => {
  const a=input();a.images.clear();assert.throws(()=>normalizeFigcraftExports(a),/image/i)
  const b=input();b.entry.figcraft.imageAlt={};assert.throws(()=>normalizeFigcraftExports(b),/alt/i)
})

test('changed mobile manuscript and mismatched layer/export structure fail instead of losing content', () => {
  const a=input();a.variants[0].tree.children[1].children[1].characters='Different text'
  assert.throws(()=>normalizeFigcraftExports(a),/content|text|match/i)
  const b=input();b.desktop.code=b.desktop.code.replace('<p class="desktop-cta">Explore cakes</p>','')
  assert.throws(()=>normalizeFigcraftExports(b),/structure|layer|match/i)
})

test('explicit decorative mobile omission may hide an extra locale label but never a manuscript paragraph', () => {
  const a=input();a.desktop.tree.children.splice(1,0,{id:8,type:'TEXT',name:'Locale Tag',characters:'en-AU'})
  a.desktop.code=a.desktop.code.replace('<div class="desktop-copy">','<p class="locale-tag">en-AU</p><div class="desktop-copy">')
  const result=normalizeFigcraftExports(a)
  assert.match(result.css,/\.fc-8\s*\{[^}]*display:\s*none/)
  const b=input();b.variants[0].tree.children[1].children.pop()
  b.variants[0].code=b.variants[0].code.replace('<p class="mobile-text">Keep this text.[1]</p>','')
  assert.throws(()=>normalizeFigcraftExports(b),/content|text|missing/i)
})

test('responsive content must have the same ordered, one-to-one text and image sequence', () => {
  const a=input(); const copy=a.variants[0].tree.children[1].children
  ;[copy[0],copy[1]]=[copy[1],copy[0]]
  a.variants[0].code=a.variants[0].code.replace('<p class="mobile-section">A section</p><p class="mobile-text">Keep this text.[1]</p>','<p class="mobile-text">Keep this text.[1]</p><p class="mobile-section">A section</p>')
  assert.throws(()=>normalizeFigcraftExports(a),/sequence|order|content/i)
  const b=input();b.desktop.tree.children[1].children.push({id:8,name:'Repeated paragraph',type:'TEXT',characters:'Keep this text.[1]'})
  b.desktop.code=b.desktop.code.replace('</div><div class="desktop-photo">','<p class="repeated">Keep this text.[1]</p></div><div class="desktop-photo">')
  assert.throws(()=>normalizeFigcraftExports(b),/sequence|content|missing/i)
  const c=input();c.variants[0].tree.children.push({id:9,type:'FRAME',name:'Extra photo',fills:[{type:'image',image:hash,scale_mode:'fill'}]})
  c.variants[0].code=c.variants[0].code.replace('</div><style>','<div class="extra-photo"></div></div><style>')
  assert.throws(()=>normalizeFigcraftExports(c),/sequence|content|image/i)
})

test('responsive styles reset properties removed from desktop and intermediate breakpoints', () => {
  const a=input();a.desktop.code=a.desktop.code.replace('font-size:44px','border:8px solid red;font-size:44px')
  const result=normalizeFigcraftExports(a)
  assert.match(result.css,/@media[\s\S]*\.fc-1\s*\{[^}]*border:\s*unset/)
})

test('every responsive image rejects unsupported crops, filters and rotations', () => {
  for(const change of [{crop:{x:0,y:0,width:.5,height:.5}},{filters:{contrast:10}},{rotation:90}]) {
    const a=input();Object.assign(a.variants[0].tree.children[2].fills[0],change)
    assert.throws(()=>normalizeFigcraftExports(a),/adjust|crop|filter|asset/i)
  }
})

test('native conditional rules and duplicate selectors fail rather than flatten or overwrite CSS', () => {
  const a=input();a.desktop.code=a.desktop.code.replace('</style>','@media(max-width:100px){.desktop-title{color:green}}</style>')
  assert.throws(()=>normalizeFigcraftExports(a),/native|rule|conditional/i)
  const b=input();b.desktop.code=b.desktop.code.replace('</style>','.desktop-title{color:green}</style>')
  assert.throws(()=>normalizeFigcraftExports(b),/duplicate|selector/i)
})

test('removed inherited properties inherit from the responsive parent', () => {
  const a=input();a.desktop.code=a.desktop.code.replace('font-size:44px','color:red;font-size:44px')
  a.variants[0].code=a.variants[0].code.replace('width:390px','color:green;width:390px')
  assert.match(normalizeFigcraftExports(a).css,/@media[\s\S]*\.fc-1\s*\{[^}]*color:\s*unset/)
})

test('an added responsive layout wrapper cannot be silently discarded', () => {
  const a=input(),copy=a.variants[0].tree.children[1]
  copy.children=[{id:99,type:'FRAME',name:'New inner layout',children:copy.children}]
  a.variants[0].code=a.variants[0].code.replace('<div class="mobile-copy">','<div class="mobile-copy"><div class="new-layout">').replace('</p></div><div class="mobile-photo">','</p></div></div><div class="mobile-photo">').replace('</style>','.new-layout{display:flex;flex-direction:column;gap:5px;padding:0}</style>')
  assert.throws(()=>normalizeFigcraftExports(a),/ambiguous|wrapper|container/i)
  const b=input(),items=b.variants[0].tree.children
  items.splice(2,2,{id:99,type:'FRAME',name:'New photo CTA layout',children:items.slice(2,4)})
  b.variants[0].code=b.variants[0].code.replace('<div class="mobile-photo">','<div class="new-layout"><div class="mobile-photo">').replace('<p class="mobile-source">','</div><p class="mobile-source">').replace('</style>','.new-layout{display:flex;flex-direction:column;gap:5px;padding:0}</style>')
  assert.throws(()=>normalizeFigcraftExports(b),/unmatched layout container/i)
})
