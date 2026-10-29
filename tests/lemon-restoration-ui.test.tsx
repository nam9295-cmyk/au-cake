import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {AuRenewalShop} from '../src/pages/AuRenewalShop';
import {RENEWAL_CART_KEY} from '../src/lib/renewal-cart';
import {CartProvider} from '../src/CartProvider';
import {AuLanguageContext} from '../src/lib/au-language';
function render(path:string,language:'en'|'ko'='en',withMeringue=false) {
 const values = new Map(withMeringue ? [[RENEWAL_CART_KEY, JSON.stringify({version:1,lines:[{lineId:'test-meringue',offerId:'halloween-meringue-3',quantity:1},{lineId:'test-cake',offerId:'pave-cake',size:'6in',quantity:1}]})]] : []);
 const storage={get length(){return values.size},key:(i:number)=>[...values.keys()][i]??null,getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>values.set(key,value)};
 Object.assign(globalThis,{window:{location:new URL(path,'http://localhost'),localStorage:storage},localStorage:storage});
 return renderToStaticMarkup(<AuLanguageContext.Provider value={{language,setLanguage(){}}}><CartProvider><AuRenewalShop path={path}/></CartProvider></AuLanguageContext.Provider>);
}
test('restored lemon detail displays four approved packs, finish count and existing detail photos',()=>{
 for(const language of ['en','ko'] as const){
  const html=render('/cakes/lemon-cake',language);
  for(const value of ['36.00','45.00','65.00','85.00','0.50'])assert.ok(html.includes(value),value);
  assert.match(html,/lemon\/hero-1080.webp/);assert.match(html,/lemon\/inside-1440.webp/);
  assert.match(html,/Dark chocolate pieces per box|박스당 초콜릿 마감 개수/);
 }
 assert.doesNotMatch(render('/cakes'),/href="\/cakes\/lemon-cake"/);
 const collection=render('/celebrate');assert.match(collection,/Small Bites/);assert.match(collection,/href="\/cakes\/lemon-cake"/);assert.doesNotMatch(collection,/href="\/cakes\/levain-cookies"/);
});
