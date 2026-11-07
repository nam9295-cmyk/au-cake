import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {AuServiceLandingPage} from '../src/pages/AuServiceLandingPage'

function mount(href:string,kind:'custom-cakes'|'business'='custom-cakes') {
 const previous={window:globalThis.window,document:globalThis.document}
 const frames=new Map<number,FrameRequestCallback>(),listeners=new Map<string,()=>void>(),calls:string[]=[],slots:unknown[]=[],cleanups:(()=>void)[]=[],effects:(()=>void)[]=[]
 let frameId=0,cursor=0,tree:React.ReactElement
 const windowDouble={location:new URL(href),addEventListener:(event:string,fn:()=>void)=>listeners.set(event,fn),removeEventListener:(event:string)=>listeners.delete(event),requestAnimationFrame:(fn:FrameRequestCallback)=>{frames.set(++frameId,fn);return frameId},cancelAnimationFrame:(id:number)=>frames.delete(id)}
 Object.assign(globalThis,{window:windowDouble,document:{getElementById(id:string){return id==='private-class-enquiry'?{scrollIntoView(options:ScrollIntoViewOptions){calls.push(`scroll:${options.block}`)}}:id==='private-class-title'?{focus(options:FocusOptions){calls.push(`focus:${options.preventScroll}`)}}:null}}})
 const dispatcher={
  useContext(){return {language:'en',setLanguage(){}}},
  useState(initial:unknown){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return [slots[i],(value:unknown)=>{slots[i]=typeof value==='function'?value(slots[i]):value}]},
  useEffect(effect:()=>void|(()=>void),dependencies:unknown[]){const i=cursor++,prior=slots[i] as unknown[]|undefined;if(!prior||dependencies.some((d,index)=>d!==prior[index])){slots[i]=dependencies;effects.push(()=>{const cleanup=effect();if(cleanup)cleanups.push(cleanup)})}},
 }
 function render(){
  cursor=0
  const internals=(React as unknown as {__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE:{H:unknown}}).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE,old=internals.H
  try{internals.H=dispatcher;tree=AuServiceLandingPage({kind})}finally{internals.H=old}
 }
 render()
 return {calls,frames,html:()=>renderToStaticMarkup(tree),flush(){while(effects.length)effects.shift()!()},paint(){for(const [id,fn] of [...frames]){frames.delete(id);fn(0)}},pop(href:string){windowDouble.location=new URL(href);listeners.get('popstate')?.();render()},close(){cleanups.forEach(fn=>fn());Object.assign(globalThis,previous)}}
}

test('a class link reveals and focuses its rendered enquiry on the first visit and tier history change',()=>{
 const page=mount('https://example.test/custom-cakes?service=private-class&tier=single#private-class-enquiry')
 try{
  page.flush()
  assert.equal(page.frames.size,1,'defer until the enquiry exists, instead of relying on pre-render native anchor scrolling')
  assert.deepEqual(page.calls,[])
  page.paint()
  assert.deepEqual(page.calls,['scroll:start','focus:true'])
  assert.match(page.html(),/<h2[^>]*id="private-class-title"[^>]*tabIndex="-1"[^>]*>Private Cake Class · Single Tier/i)
  page.pop('https://example.test/custom-cakes?service=private-class&tier=double#private-class-enquiry');page.flush();page.paint()
  assert.equal(page.calls.length,4)
  assert.match(page.html(),/>Private Cake Class · Two Tiers<\/h2>/)
 }finally{page.close()}
})

test('ordinary hub and business visits do not jump, and leaving cancels a pending class jump',()=>{
 for(const [href,kind] of [['https://example.test/custom-cakes','custom-cakes'],['https://example.test/business?service=private-class&tier=single','business']] as const){const page=mount(href,kind);try{page.flush();assert.equal(page.frames.size,0);assert.deepEqual(page.calls,[])}finally{page.close()}}
 const page=mount('https://example.test/custom-cakes?service=private-class&tier=double#private-class-enquiry')
 page.flush();page.close();assert.equal(page.frames.size,0)
})
