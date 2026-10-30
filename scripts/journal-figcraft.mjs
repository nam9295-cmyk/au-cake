import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { resolve, join, dirname } from 'node:path'
import { pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'
import { unzipSync } from 'fflate'
import { parseFragment, serialize } from 'parse5'
import postcss from 'postcss'

const fail = message => { throw new Error(`FigCraft import: ${message}`) }
const clean = value => String(value || '').replace(/\s+/g,' ').trim()
const decorative = node => /^(?:mobile\s+)?(?:locale tag|category kicker|cta eyebrow|editorial meta|mobile kicker)$/i.test(node.name)
const attr = (node,name) => node.attrs.find(a=>a.name===name)?.value
function setAttr(node,name,value) { const a=node.attrs.find(a=>a.name===name); if(a)a.value=String(value);else node.attrs.push({name,value:String(value)}) }
function textContent(node) { return node.nodeName==='#text' ? node.value : node.tagName==='br' ? '\n' : (node.childNodes||[]).map(textContent).join('') }
function nodes(root) { const result=[];function walk(n){if(n.tagName)result.push(n);for(const child of n.childNodes||[])walk(child)}walk(root);return result }
function treeNodes(root) { const result=[];function walk(n){if(n.visible===false)return;result.push(n);for(const c of n.children||[])walk(c)}walk(root);return result }
function imageFill(node) { return (node.fills||[]).find(f=>f.type?.toLowerCase()==='image'&&f.visible!==false) }
function tokenList(node) {
  if(node.type==='TEXT')return decorative(node)?[]:['T:'+clean(node.characters)]
  const fill=imageFill(node)
  if(fill)return ['I:'+fill.image]
  return (node.children||[]).filter(c=>c.visible!==false).flatMap(tokenList)
}
function makeFrame(frame) {
  const fragment=parseFragment(frame.code)
  const root=fragment.childNodes.find(n=>n.tagName&&n.tagName!=='style')
  if(!root)fail('HTML export has no root')
  const markup=nodes(root),layers=treeNodes(frame.tree)
  if(markup.some(el=>el.tagName==='br'&&el.parentNode?.tagName!=='p'))fail('Line breaks must belong to native text layers')
  const els=markup.filter(el=>el.tagName!=='br')
  if(els.length!==layers.length)fail('Export/layer structure mismatch; rich/vector content needs a reviewed adapter')
  const cssText=fragment.childNodes.filter(n=>n.tagName==='style').map(textContent).join('\n')
  const css=postcss.parse(cssText),styles=new Map()
  if(css.nodes.some(n=>!['rule','comment'].includes(n.type)))fail('Unsupported conditional/native CSS rule')
  css.walkRules(rule=>{
    if(rule.parent!==css||rule.nodes.some(n=>!['decl','comment'].includes(n.type)))fail('Unsupported nested native CSS rule')
    if(!/^\.[a-zA-Z0-9_-]+$/.test(rule.selector))fail('Unsupported native CSS selector')
    if(styles.has(rule.selector.slice(1)))fail('Duplicate native CSS selector')
    styles.set(rule.selector.slice(1),rule.nodes.filter(n=>n.type==='decl').map(d=>d.clone()))
  })
  const seen=new Set()
  const records=layers.map((node,i)=>{
    const el=els[i]
    if((node.type==='TEXT'&&el.tagName!=='p')||(node.type!=='TEXT'&&el.tagName!=='div'))fail('Native HTML/layer type mismatch')
    if(node.type==='TEXT'&&clean(textContent(el))!==clean(node.characters))fail('Native text content mismatch')
    const className=attr(el,'class')
    if(!className||seen.has(className))fail('Duplicate/missing native class name')
    seen.add(className)
    const fill=imageFill(node)
    if(fill&&(fill.crop||fill.rotation||Object.values(fill.filters||{}).some(v=>v!==0)||!['fill','fit',undefined].includes(fill.scale_mode)))fail('Image adjustments require a reviewed asset export')
    const kind=node.type==='TEXT'?'text':fill?'image':'container'
    return {node,el,kind,fill,style:styles.get(className)||[],tokens:tokenList(node),selector:`.fc-${node.id}`}
  })
  return {...frame,fragment,root,records}
}
function ruleFor(selector,record,properties=[]) {
  const rule=postcss.rule({selector})
  const present=new Set(record.style.map(d=>d.prop))
  if(!present.has('display'))rule.append({prop:'display',value:'block'})
  for(const property of properties)if(!present.has(property)&&property!=='display')rule.append({prop:property,value:property==='position'?'static':'unset'})
  for(const original of record.style) {
    const d=original.clone()
    if(record.kind==='image'&&/background/i.test(d.prop)&&/url\(/i.test(d.value))continue
    if(d.prop==='width'&&/^\d+(?:\.\d+)?px$/.test(d.value))d.value=`min(100%, ${d.value})`
    rule.append(d)
  }
  rule.append({prop:'min-width',value:'0'})
  if(record.kind==='image') {
    rule.append({prop:'display',value:'block'})
    rule.append({prop:'object-fit',value:record.fill.scale_mode==='fit'?'contain':'cover'})
    rule.append({prop:'object-position',value:'center'})
  }
  return rule
}
function neutralWrapper(record) {
  return record.kind==='container'&&!record.style.some(d=>/^(background|border|box-shadow)/.test(d.prop)&&!['none','transparent','0','0px'].includes(d.value))&&
    !record.style.some(d=>d.prop==='padding'&&!/^(0px?|\s)+$/.test(d.value))
}
function matchFrame(main,other) {
  const content=frame=>frame.records.filter(r=>r.kind==='image'||(r.kind==='text'&&!decorative(r.node)))
  const a=content(main),b=content(other)
  if(JSON.stringify(a.map(r=>r.tokens))!==JSON.stringify(b.map(r=>r.tokens)))fail('Variant content sequence must match desktop exactly, including repeated text and images')
  const matches=new Map(a.map((r,i)=>[r,b[i]])),used=new Set(b)
  matches.set(main.records[0],other.records[0]);used.add(other.records[0])
  for(const r of main.records.slice(1)) {
    if(matches.has(r))continue
    const candidates=other.records.filter(s=>{
      if(used.has(s)||s.kind!==r.kind)return false
      if(r.kind==='text')return clean(s.node.characters)===clean(r.node.characters)
      if(r.tokens.length)return JSON.stringify(s.tokens)===JSON.stringify(r.tokens)
      return s.node.name===r.node.name&&(decorative(r.node)||(!(r.node.children||[]).length&&!(s.node.children||[]).length))
    })
    if(candidates.length>1)fail(`Ambiguous responsive layer mapping for ${r.node.id}`)
    if(candidates.length){matches.set(r,candidates[0]);used.add(candidates[0])}
    else if(r.kind==='container'&&!neutralWrapper(r))fail(`Unmatched styled container ${r.node.id}; export needs a reviewed adapter`)
  }
  // A new styled wrapper cannot be recreated merely by copying descendant styles.
  for(const r of other.records)if(!used.has(r)&&r.kind==='container'&&!r.style.some(d=>d.prop==='display'&&d.value==='contents'))fail(`Variant adds an unmatched layout container: ${r.node.id} (${r.node.name})`)
  return matches
}
function tag(node,name) { node.nodeName=node.tagName=name }
function trimUrl(value) {
  let url=value.replace(/[.,;!?]+$/,'')
  // Keep legitimate balanced URL parentheses, excluding surrounding prose punctuation.
  while(url.endsWith(')')&&(url.match(/\)/g)||[]).length>(url.match(/\(/g)||[]).length)url=url.slice(0,-1)
  return url.replace(/[.,;!?]+$/,'')
}
function addLinks(el,sourceIds,definitions=new Set()) {
  for(const child of [...(el.childNodes||[])]) {
    if(child.nodeName!=='#text')continue
    const text=child.value,parts=[],pattern=/https:\/\/[^\s]+|\[(\d+)\]/g
    let cursor=0
    for(const match of text.matchAll(pattern)) {
      const label=match[1]?match[0]:trimUrl(match[0])
      const href=match[1]?(sourceIds.has(match[1])?`#source-${match[1]}`:null):label
      if(!href)continue
      if(match.index>cursor)parts.push({nodeName:'#text',value:text.slice(cursor,match.index),parentNode:el})
      const a={nodeName:'a',tagName:'a',namespaceURI:'http://www.w3.org/1999/xhtml',attrs:[{name:'href',value:href}],childNodes:[],parentNode:el}
      if(match[1]&&definitions.has(match[1])&&/(?:^|\n)[ \t]*$/.test(text.slice(0,match.index)))setAttr(a,'id',`source-${match[1]}`)
      a.childNodes=[{nodeName:'#text',value:label,parentNode:a}];parts.push(a);cursor=match.index+label.length
    }
    if(cursor){if(cursor<text.length)parts.push({nodeName:'#text',value:text.slice(cursor),parentNode:el});el.childNodes.splice(el.childNodes.indexOf(child),1,...parts)}
  }
}

/** Pure normalization of genuine FigCraft inspect.code results; one DOM for all viewports. */
export function normalizeFigcraftExports({entry,desktop,variants=[],images,version}) {
  const main=makeFrame(desktop),others=variants.map(v=>makeFrame(v))
  const mappings=new Map(others.map(other=>[other,matchFrame(main,other)]))
  const rootSelector=main.records[0].selector
  const sheet=postcss.root(),files=new Map(),sources=new Set(),sourceLists=new Map()
  for(const r of main.records)if(r.kind==='text') {
    const source=r.node.name.match(/source\s*\[(\d+)\]/i)
    if(source){sources.add(source[1]);setAttr(r.el,'id',`source-${source[1]}`)}
    else if(/^(?:sources|references) list$/i.test(r.node.name)) {
      const definitions=new Set([...r.node.characters.matchAll(/^\s*\[(\d+)\]/gm)].map(m=>m[1]))
      for(const id of definitions)sources.add(id)
      sourceLists.set(r,definitions)
    }
  }
  let h1=0
  for(const r of main.records) {
    setAttr(r.el,'class',r.selector.slice(1))
    if(r.kind==='text') {
      if(/\bh1\b/i.test(r.node.name)){tag(r.el,'h1');h1++;if(clean(r.node.characters)!==clean(entry.title))fail('H1 does not match article title')}
      else if(/\bh([2-6])\b/i.test(r.node.name))tag(r.el,'h'+r.node.name.match(/\bh([2-6])\b/i)[1])
      const href=entry.figcraft?.links?.[String(r.node.id)]
      if(href) {
        const a={nodeName:'a',tagName:'a',namespaceURI:'http://www.w3.org/1999/xhtml',attrs:[{name:'href',value:href}],childNodes:r.el.childNodes,parentNode:r.el}
        for(const child of a.childNodes)child.parentNode=a
        r.el.childNodes=[a]
      } else addLinks(r.el,sources,sourceLists.get(r))
    }
    if(r.kind==='image') {
      const hash=r.fill.image
      if(!/^[a-f0-9]{64}$/.test(hash)||!images.has(hash))fail('Missing image data')
      if((r.node.children||[]).length)fail('Image frames with children need a reviewed adapter')
      if(r.fill.crop||r.fill.rotation||Object.values(r.fill.filters||{}).some(v=>v!==0)||!['fill','fit',undefined].includes(r.fill.scale_mode))fail('Image adjustments require a reviewed asset export')
      const alt=entry.figcraft?.imageAlt?.[String(r.node.id)]
      if(typeof alt!=='string'||!alt.trim())fail('Image alt text is required')
      const path=`assets/${hash}.png`
      files.set(path,{path,data:images.get(hash)})
      tag(r.el,'img');r.el.childNodes=[];setAttr(r.el,'src',path);setAttr(r.el,'alt',alt)
    }
    sheet.append(ruleFor(r.selector,r))
  }
  if(h1!==1)fail('Exactly one named H1 text layer is required')
  const reset=postcss.parse(`${rootSelector},${rootSelector} *{box-sizing:border-box}${rootSelector} :is(p,h1,h2,h3,h4,h5,h6,figure){margin:0}${rootSelector} a{color:inherit;font:inherit;text-underline-offset:.2em}`)
  sheet.prepend(...reset.nodes)
  for(const other of others.sort((a,b)=>b.maxWidth-a.maxWidth)) {
    if(!Number.isInteger(other.maxWidth)||other.maxWidth<240||other.maxWidth>4096)fail('Invalid responsive breakpoint')
    const media=postcss.atRule({name:'media',params:`(max-width: ${other.maxWidth}px)`})
    for(const r of main.records) {
      const match=mappings.get(other).get(r)
      const properties=new Set([r,...others.map(o=>mappings.get(o).get(r)).filter(Boolean)].flatMap(s=>s.style.map(d=>d.prop)))
      if(match)media.append(ruleFor(r.selector,match,properties))
      else if(r.kind==='text') {
        if(!decorative(r.node))fail(`Variant is missing manuscript text layer ${r.node.id}`)
        media.append(postcss.rule({selector:r.selector}).append({prop:'display',value:'none'}))
      } else if(r.kind==='image')fail('Variant is missing a content image')
      else if(neutralWrapper(r))media.append(postcss.rule({selector:r.selector}).append({prop:'display',value:'contents'}))
    }
    sheet.append(media)
  }
  const coverRecord=main.records.find(r=>String(r.node.id)===String(entry.cover?.layer)&&r.kind==='image')
  if(!coverRecord)fail('Cover must name a desktop image layer')
  const resultEntry={...entry,cover:{src:`assets/${coverRecord.fill.image}.png`,alt:entry.cover.alt||entry.figcraft.imageAlt[String(coverRecord.node.id)]},source:{tool:'figcraft',version,frames:{desktop:desktop.tree.id,variants:variants.map(v=>({frame:v.tree.id,maxWidth:v.maxWidth}))}}}
  delete resultEntry.figcraft
  return {entry:resultEntry,html:serialize(main.fragment).replace(/<style>[\s\S]*?<\/style>/g,''),css:sheet.toString(),files:[...files.values()],report:{source:resultEntry.source,images:files.size,viewports:[desktop.width,...variants.map(v=>v.width)],normalization:['semantic headings','content image paths/alt','explicit product links and source citations','one responsive article DOM']}}
}

export async function exportFigcraftPackage({file,metadata,outputDirectory,cli=process.env.FIGCRAFT_CLI||'figcraft-cli'}) {
  if(resolve(outputDirectory)===dirname(resolve(file)))fail('Keep export output separate from original design folder')
  const input=JSON.parse(await readFile(metadata,'utf8'))
  const definitions=[{id:input.figcraft?.desktop},...(input.figcraft?.variants||[]).map(v=>({id:v.frame,maxWidth:v.maxWidth}))]
  if(!definitions[0].id)fail('Metadata must identify desktop frame')
  const messages=[{jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-06-18',capabilities:{},clientInfo:{name:'verygood-journal-import',version:'1.0'}}},{jsonrpc:'2.0',method:'notifications/initialized',params:{}},{jsonrpc:'2.0',id:2,method:'tools/call',params:{name:'open_file',arguments:{path:resolve(file)}}}]
  let id=3
  for(const frame of definitions){frame.treeId=id++;frame.codeId=id++;messages.push({jsonrpc:'2.0',id:frame.treeId,method:'tools/call',params:{name:'get_node',arguments:{id:frame.id,depth:20}}},{jsonrpc:'2.0',id:frame.codeId,method:'tools/call',params:{name:'run_command',arguments:{command:'inspect.code',params:{id:frame.id,language:'html'}}}})}
  const run=spawnSync(cli,['mcp'],{input:messages.map(m=>JSON.stringify(m)+'\n').join(''),encoding:'utf8',timeout:90000,maxBuffer:32*1024*1024})
  if(run.error||run.status!==0)fail(`CLI failed: ${run.error?.message||run.stderr.slice(-300)}`)
  const replies=new Map(run.stdout.split('\n').filter(Boolean).map(line=>{const r=JSON.parse(line);return [r.id,r]}))
  function result(key){const r=replies.get(key);if(r?.error||!r?.result||r.result.isError)fail('CLI export request failed: '+JSON.stringify(r?.error||r?.result));return r.result}
  function data(key){return JSON.parse(result(key).content.find(c=>c.type==='text').text)}
  result(2)
  const frames=definitions.map(f=>{const tree=data(f.treeId);if(tree.truncated)fail('Layer tree is truncated');return {tree,code:data(f.codeId).code,width:tree.width,maxWidth:f.maxWidth}})
  const bytes=await readFile(file);if(bytes.length>32*1024*1024)fail('Native file exceeds 32 MiB import limit')
  let total=0
  const archive=unzipSync(bytes,{filter:entry=>{total+=entry.originalSize;if(total>128*1024*1024||entry.originalSize>32*1024*1024)fail('Native archive exceeds image size limit');return /^images\/[a-f0-9]{64}$/.test(entry.name)}})
  const images=new Map(Object.entries(archive).map(([path,data])=>[path.slice(7),Buffer.from(data)]))
  const compiled=normalizeFigcraftExports({entry:input,desktop:frames[0],variants:frames.slice(1),images,version:result(1).serverInfo.version})
  await mkdir(outputDirectory,{recursive:true})
  for(const f of compiled.files){const path=join(outputDirectory,f.path);await mkdir(dirname(path),{recursive:true});await writeFile(path,f.data)}
  await writeFile(join(outputDirectory,'index.html'),`<!doctype html><html lang="${compiled.entry.locale}"><head><link rel="stylesheet" href="style.css"></head><body>${compiled.html}</body></html>`)
  await writeFile(join(outputDirectory,'style.css'),compiled.css)
  await writeFile(join(outputDirectory,'article.json'),JSON.stringify(compiled.entry,null,2))
  await writeFile(join(outputDirectory,'figcraft-report.json'),JSON.stringify(compiled.report,null,2))
  return compiled.report
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const args=process.argv.slice(2);const option=key=>args.includes(key)?args[args.indexOf(key)+1]:undefined
  try{if(!option('--file')||!option('--metadata')||!option('--output'))fail('Usage: --file source.figcraft --metadata article.json --output /private/export');console.log(JSON.stringify(await exportFigcraftPackage({file:option('--file'),metadata:option('--metadata'),outputDirectory:option('--output')}),null,2))}catch(error){console.error(error.message);process.exitCode=1}
}
