import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {AuRenewalShop} from '../src/pages/AuRenewalShop'
import {CartProvider} from '../src/CartProvider'
import {AuLanguageContext} from '../src/lib/au-language'
import {inspectRenewalCart, RENEWAL_CART_KEY, addRenewalLines} from '../src/lib/renewal-cart'
import {readCustomerCart, CART_EVENT_PREFIX} from '../src/lib/customer-cart-storage'
const milk={lineId:'old',offerId:'pave-cake',size:'8in',quantity:1,chocolateType:'milk'}
const good={lineId:'good',offerId:'brownie-whole',size:'6in',quantity:1}
function storage(values:Record<string,string>={}) {
 const data=new Map(Object.entries(values))
 return {get length(){return data.size}, key:(i:number)=>[...data.keys()][i]??null,getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>{data.set(k,v)}}
}
function render(path:string,language:'en'|'ko'='en',lines:unknown[]=[]) {
 const store=storage({[RENEWAL_CART_KEY]:JSON.stringify({version:1,lines})})
 Object.assign(globalThis,{window:{location:new URL(path,'https://example.test'),localStorage:store},localStorage:store})
 return renderToStaticMarkup(<AuLanguageContext.Provider value={{language,setLanguage(){}}}><CartProvider><AuRenewalShop path={path.split('?')[0]}/></CartProvider></AuLanguageContext.Provider>)
}

test('almond packaging is selectable only for singles and survives cart storage and edit links',()=>{
 const single=render('/chocolates/almond-chocoball?almondPackaging=triangle-box');
 assert.match(single,/Choose your packaging/); assert.match(single,/Triangle box/);
 const tub=render('/chocolates/almond-chocoball?offer=almond-chocoball-black-tub-2x80g&almondPackaging=triangle-box');
 assert.match(tub,/Packaging: Pouch/); assert.doesNotMatch(tub,/Choose your packaging/);
 const base={offerId:'almond-chocoball-80g',quantity:1};
 const lines=addRenewalLines([],[{...base,lineId:'a',almondPackaging:'pouch'},{...base,lineId:'b',almondPackaging:'triangle-box'}]);
 assert.equal(lines.length,2);
 assert.equal(inspectRenewalCart(JSON.stringify({version:1,lines})).lines[1].almondPackaging,'triangle-box');
 assert.match(renewalSelectionHref(lines[1],'b')!,/almondPackaging=triangle-box/);
});
import {renewalSelectionHref} from '../src/lib/renewal-cart';
