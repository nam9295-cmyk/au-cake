import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {AuRenewalShop} from '../src/pages/AuRenewalShop';
import {HalloweenMeringueSection} from '../src/components/HalloweenMeringueSection';
import {RENEWAL_CART_KEY} from '../src/lib/renewal-cart';
import {CartProvider} from '../src/CartProvider';
import {AuLanguageContext} from '../src/lib/au-language';
function render(path:string,language:'en'|'ko'='en',withMeringue=false) {
 const values = new Map(withMeringue ? [[RENEWAL_CART_KEY, JSON.stringify({version:1,lines:[{lineId:'test-meringue',offerId:'halloween-meringue-3',quantity:1},{lineId:'test-cake',offerId:'pave-cake',size:'6in',quantity:1}]})]] : []);
 const storage={get length(){return values.size},key:(i:number)=>[...values.keys()][i]??null,getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>values.set(key,value)};
 Object.assign(globalThis,{window:{location:new URL(path,'http://localhost'),localStorage:storage},localStorage:storage});
 return renderToStaticMarkup(<AuLanguageContext.Provider value={{language,setLanguage(){}}}><CartProvider><AuRenewalShop path={path}/></CartProvider></AuLanguageContext.Provider>);
}
test('meringue detail offers all four packs, per-piece amounts and final pickup in both languages',t=>{
 t.mock.timers.enable({apis:['Date'],now:Date.parse('2026-10-28T00:00:00Z')});
 for(const language of ['en','ko'] as const){
  const html=render('/cakes/halloween-meringue',language);
  for(const value of ['12.00','23.00','45.00','85.00','4.00','3.83','3.75','3.54']) assert.ok(html.includes(value),value);
  assert.match(html,/24/);assert.match(html,/1 November|11월 1일/);assert.match(html,/halloween-meringue\/1.webp/);
  assert.match(html,/halloween-meringue\/2.webp/);
 }
});
test('ended detail disables purchase and collection hides seasonal item without deleting permanent products',t=>{
 t.mock.timers.enable({apis:['Date'],now:Date.parse('2026-11-01T00:00:00Z')});
 const html=render('/cakes/halloween-meringue');
 assert.match(html,/Seasonal orders have closed/);assert.match(html,/disabled=""/);
 const collection=render('/cakes');assert.doesNotMatch(collection,/href="\/cakes\/halloween-meringue"/);assert.match(collection,/pave-chocolate-cake/);
});
test('active cakes collection includes seasonal card',t=>{
 t.mock.timers.enable({apis:['Date'],now:Date.parse('2026-10-28T00:00:00Z')});
 assert.match(render('/cakes'),/href="\/cakes\/halloween-meringue"/);
});

test('home season section hides after deadline and does not need a new deployment',t=>{
 t.mock.timers.enable({apis:['Date'],now:Date.parse('2026-10-28T00:00:00Z')});
 assert.match(renderToStaticMarkup(<HalloweenMeringueSection language="en"/>),/CHOOSE YOUR PACK/);
 assert.match(renderToStaticMarkup(<HalloweenMeringueSection language="ko"/>),/세트 선택하기/);
 t.mock.timers.setTime(Date.parse('2026-10-31T02:00:00.001Z'));
 assert.equal(renderToStaticMarkup(<HalloweenMeringueSection language="en"/>),'');
});
test('expired cart retains both products and provides removal guidance instead of dropping selections',t=>{
 t.mock.timers.enable({apis:['Date'],now:Date.parse('2026-11-02T00:00:00Z')});
 const html=render('/cart','en',true);
 assert.match(html,/Halloween orders have closed/);
 assert.match(html,/Halloween Meringue Pops/);assert.match(html,/Pavé Whole Cake/);
 assert.match(html,/>Remove /);assert.match(html,/disabled=""[^>]*>Send request/);
});
