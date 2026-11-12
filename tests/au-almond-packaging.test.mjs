import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeRenewalLines,priceRenewalOrder,renewalLineSummary} from '../appwrite-functions/reservation-api/src/au-renewal.js';
const base={lineId:'a',offerId:'almond-chocoball-80g',quantity:1};
test('single almond packaging survives normalization at the same price and appears in fulfilment summary',()=>{
 for(const packaging of ['pouch','triangle-box']) {
  const line=priceRenewalOrder([{...base,almondPackaging:packaging}]).lines[0];
  assert.equal(line.selection.almondPackaging,packaging);
  assert.equal(line.totalPriceCents,1200);
  assert.match(renewalLineSummary(line),packaging==='pouch'?/Pouch/:/Triangle box/);
 }
 assert.equal(normalizeRenewalLines([base])[0].almondPackaging,'pouch');
});
test('black tub stays pouch and bundles retain their existing price',()=>{
 const tub={...base,offerId:'almond-chocoball-black-tub-2x80g'};
 assert.equal(priceRenewalOrder([tub]).lines[0].selection.almondPackaging,'pouch');
 assert.equal(priceRenewalOrder([tub]).totalPriceCents,2500);
 assert.equal(priceRenewalOrder([{...base,offerId:'almond-chocoball-6pack'}]).totalPriceCents,6000);
 for(const input of [{...tub,almondPackaging:'triangle-box'},{...base,almondPackaging:'bad'},{...base,offerId:'pound-cake',almondPackaging:'pouch'}]) assert.throws(()=>normalizeRenewalLines([input]));
});
import {readRenewalDocument} from '../appwrite-functions/reservation-api/src/au-renewal-reader.js';
test('new and historical almond snapshots round-trip without rewriting old orders',()=>{
 for(const packaging of [undefined,'pouch','triangle-box']) {
  const quote=priceRenewalOrder([{...base,...(packaging?{almondPackaging:packaging}:{})}],{storedOnly:packaging===undefined});
  const {lines,version,policyVersion,...totals}=quote;
  const doc={...totals,productId:base.offerId,quantity:1,orderLineCount:1,orderLinesJson:JSON.stringify({lines,version,policyVersion,discountPercent:quote.discountPercent})};
  assert.deepEqual(readRenewalDocument(doc).lines,lines);
  assert.equal(lines[0].selection.almondPackaging,packaging);
 }
});
