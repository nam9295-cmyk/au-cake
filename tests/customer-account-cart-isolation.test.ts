import test from 'node:test'
import assert from 'node:assert/strict'
import * as cart from '../src/lib/customer-cart-storage'
import {CART_STORAGE_KEY,addCartLine,serializeCartLines} from '../src/lib/cart'
import {RENEWAL_CART_KEY,MOCHI_RESELECTION_KEY} from '../src/lib/renewal-cart'
import {createCakeDetailSelection} from '../src/lib/cake-detail'
import {CUSTOMER_AUTH_NOTICE_KEY} from '../src/lib/customer-account-config'
const cake={lineId:'pave',offerId:'pave-cake',size:'6in',quantity:1}
const chocolate={lineId:'chocolate',offerId:'pave-chocolate-100g',quantity:1}
function memory(){const data=new Map<string,string>();return {data,get length(){return data.size},key:(i:number)=>[...data.keys()][i]??null,getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>{data.set(k,v)},removeItem:(k:string)=>{data.delete(k)}}}
const create=(storage:ReturnType<typeof memory>,owner:string|null='guest')=>Reflect.get(cart,'createCustomerCartStore')({storage,owner,authFence:true})
const mutate=(store:ReturnType<typeof create>,action:unknown)=>store.mutate(store.ticket(),action)
test('real cart storage restores G and H independently across logout, Guest and refresh',()=>{
 const storage=memory(),s=create(storage)
 s.selectOwner('user:G');mutate(s,{type:'renewal-add',lines:[cake]});assert.equal(s.getSnapshot().renewalLines.length,1)
 s.selectOwner('guest');assert.equal(s.getSnapshot().renewalLines.length,0)
 s.selectOwner('user:H');assert.equal(s.getSnapshot().renewalLines.length,0);mutate(s,{type:'renewal-add',lines:[chocolate]})
 s.selectOwner('guest');assert.equal(s.getSnapshot().renewalLines.length,0)
 s.selectOwner('user:G');assert.deepEqual(s.getSnapshot().renewalLines.map((l:typeof cake)=>l.offerId),['pave-cake'])
 assert.deepEqual(create(storage,'user:H').getSnapshot().renewalLines.map((l:typeof cake)=>l.offerId),['pave-chocolate-100g'])
})
test('both old common keys and retired mochi remain Guest data, never first-member data',()=>{
 const storage=memory(),selection=createCakeDetailSelection('pave-chocolate-cake')!
 storage.setItem(CART_STORAGE_KEY,serializeCartLines(addCartLine([],selection)))
 storage.setItem(RENEWAL_CART_KEY,JSON.stringify({version:1,lines:[cake]}))
 storage.setItem(MOCHI_RESELECTION_KEY,JSON.stringify({lines:[{offerId:'mochi',mode:'retired'}],acknowledged:false}))
 const before=[...storage.data],guest=create(storage),g=create(storage,'user:G')
 assert.equal(guest.getSnapshot().lines.length,1);assert.equal(guest.getSnapshot().renewalLines.length,1);assert.equal(guest.getSnapshot().mochiReselectionRequired,true)
 assert.equal(g.getSnapshot().lines.length,0);assert.equal(g.getSnapshot().renewalLines.length,0);assert.deepEqual([...storage.data],before)
 assert.equal(g.getSnapshot().canImportGuest,true)
 mutate(g,{type:'import-guest'});assert.equal(g.getSnapshot().renewalLines.length,1);assert.equal(g.getSnapshot().lines.length,1)
 mutate(g,{type:'import-guest'});assert.equal(g.getSnapshot().renewalLines[0].quantity,1)
 assert.equal(create(storage).getSnapshot().renewalLines[0].quantity,1)
})
test('auth checks hide member data and stale callbacks cannot write into G, H or Guest',()=>{
 const storage=memory(),s=create(storage,'user:G');mutate(s,{type:'renewal-add',lines:[cake]});const stale=s.ticket()
 s.selectOwner(null);assert.equal(s.getSnapshot().renewalLines.length,0);assert.equal(s.getSnapshot().ready,false)
 assert.equal(s.mutate(stale,{type:'renewal-add',lines:[chocolate]}),false)
 s.selectOwner('user:H');mutate(s,{type:'renewal-add',lines:[chocolate]});assert.equal(s.mutate(stale,{type:'renewal-clear'}),false);assert.equal(s.getSnapshot().renewalLines.length,1)
 s.selectOwner('user:G');assert.equal(s.getSnapshot().renewalLines.length,1)
})
test('other-tab auth notice blocks a stale write before the storage event is delivered',()=>{
 const storage=memory(),s=create(storage,'user:G'),ticket=s.ticket()
 storage.setItem(CUSTOMER_AUTH_NOTICE_KEY,'new-auth-transition')
 assert.equal(s.mutate(ticket,{type:'renewal-add',lines:[cake]}),false);assert.equal(s.getSnapshot().ready,false)
 s.selectOwner('user:H');mutate(s,{type:'renewal-add',lines:[chocolate]})
 assert.equal(create(storage,'user:G').getSnapshot().renewalLines.length,0)
})
test('concurrent tab additions survive interleaved storage writes without replacing snapshots',()=>{
 const storage=memory(),a=create(storage,'user:G'),b=create(storage,'user:G'),put=storage.setItem
 let interleaved=false
 storage.setItem=(key,value)=>{if(!interleaved){interleaved=true;mutate(b,{type:'renewal-add',lines:[cake]})}put(key,value)}
 mutate(a,{type:'renewal-add',lines:[cake]});a.refresh();b.refresh()
 assert.equal(a.getSnapshot().renewalLines[0].quantity,2);assert.equal(b.getSnapshot().renewalLines[0].quantity,2)
 assert.equal(storage.getItem(RENEWAL_CART_KEY),null)
})
test('legacy and Renewal quantity, removal, submitted subtraction and mochi acknowledgement stay scoped',()=>{
 const storage=memory(),s=create(storage,'user:G'),selection=createCakeDetailSelection('pave-chocolate-cake')!
 mutate(s,{type:'legacy-add',selection});const key=s.getSnapshot().lines[0].lineKey
 mutate(s,{type:'legacy-update',key,quantity:3});assert.equal(s.getSnapshot().lines[0].selection.quantity,3)
 mutate(s,{type:'legacy-submitted',lines:addCartLine([],selection)});assert.equal(s.getSnapshot().lines[0].selection.quantity,2)
 mutate(s,{type:'legacy-remove',key});assert.equal(s.getSnapshot().lines.length,0)
 mutate(s,{type:'renewal-add',lines:[cake]});const submitted=s.getSnapshot().renewalLines;mutate(s,{type:'renewal-update',id:'pave',quantity:3})
 mutate(s,{type:'renewal-submitted',lines:submitted});assert.equal(s.getSnapshot().renewalLines[0].quantity,2)
 mutate(s,{type:'renewal-replace',id:'pave',lines:[chocolate]});assert.equal(s.getSnapshot().renewalLines[0].offerId,chocolate.offerId)
 mutate(s,{type:'renewal-remove',id:'chocolate'});assert.equal(s.getSnapshot().renewalLines.length,0)
})
test('owner resolution uses verified UID only and never uses previousIdentity while checking',()=>{
 const owner=Reflect.get(cart,'customerCartOwner')
 assert.equal(owner({status:'authenticated',identity:{userId:'G'}},true),'user:G')
 assert.equal(owner({status:'checking',previousIdentity:{userId:'G'}},true),null)
 assert.equal(owner({status:'unavailable'},true),'guest');assert.equal(owner({status:'guest'},true),'guest')
 assert.equal(owner({status:'authenticated',identity:{userId:'G'}},false),'guest')
 assert.equal(owner({status:'authenticated',identity:{userId:'../bad'}},true),null)
})
test('checkout signatures describe only the current owner cart, not an ever-growing edit history',()=>{
 const signature=Reflect.get(cart,'scopedCartSignature'),storage=memory(),s=create(storage,'user:G')
 mutate(s,{type:'renewal-add',lines:[cake]});const initial=signature(storage,'renewal','user:G')
 mutate(s,{type:'renewal-update',id:'pave',quantity:1});assert.equal(signature(storage,'renewal','user:G'),initial)
 for(let i=0;i<30;i++)mutate(s,{type:'renewal-update',id:'pave',quantity:i%5+1})
 assert.ok(signature(storage,'renewal','user:G').length<2048)
})
test('a same-UID focus recheck preserves valid completion callbacks but a real account switch invalidates them',()=>{
 const storage=memory(),s=create(storage,'user:G');mutate(s,{type:'renewal-add',lines:[cake]});const ticket=s.ticket(),submitted=s.getSnapshot().renewalLines
 s.selectOwner(null);assert.equal(s.mutate(ticket,{type:'renewal-clear'}),false)
 s.selectOwner('user:G');assert.equal(s.mutate(ticket,{type:'renewal-submitted',lines:submitted}),true);assert.equal(s.getSnapshot().renewalLines.length,0)
 s.selectOwner('user:H');s.selectOwner('user:G');assert.equal(s.mutate(ticket,{type:'renewal-add',lines:[cake]}),false)
})
test('cart payloads exclude profile and auth fields and a failed save never empties another owner',()=>{
 const storage=memory(),s=create(storage,'user:G'),selection=createCakeDetailSelection('pave-chocolate-cake')!
 mutate(s,{type:'legacy-add',selection:{...selection,email:'private@example.test',jwt:'never-store-this'}})
 const raw=[...storage.data.values()].join('');assert.doesNotMatch(raw,/private@example|never-store-this/)
 const put=storage.setItem;storage.setItem=()=>{throw Error('full')}
 assert.equal(mutate(s,{type:'renewal-add',lines:[cake]}),false);assert.equal(s.getSnapshot().storageError,true);assert.equal(s.getSnapshot().lines.length,1)
 storage.setItem=put;s.selectOwner('user:H');assert.equal(s.getSnapshot().lines.length,0)
 s.selectOwner('user:G');assert.equal(s.getSnapshot().lines.length,1)
})
test('late async completion cannot subtract from the newly selected account',async()=>{
 const s=create(memory(),'user:G');mutate(s,{type:'renewal-add',lines:[cake]});const old=s.ticket(),submitted=s.getSnapshot().renewalLines
 const completion=Promise.resolve().then(()=>s.mutate(old,{type:'renewal-submitted',lines:submitted}))
 s.selectOwner('user:H');mutate(s,{type:'renewal-add',lines:[chocolate]})
 assert.equal(await completion,false);assert.equal(s.getSnapshot().renewalLines[0].offerId,'pave-chocolate-100g')
 s.selectOwner('user:G');assert.equal(s.getSnapshot().renewalLines.length,1)
})
test('mochi configuration and retired Guest acknowledgement survive refresh without cross-account conversion',()=>{
 const storage=memory();storage.setItem(MOCHI_RESELECTION_KEY,JSON.stringify({lines:[{offerId:'mochi',mode:'retired'}],acknowledged:false}))
 const s=create(storage),raw=storage.getItem(MOCHI_RESELECTION_KEY);mutate(s,{type:'acknowledge-mochi'})
 assert.equal(create(storage).getSnapshot().mochiReselectionRequired,false);assert.equal(storage.getItem(MOCHI_RESELECTION_KEY),raw)
 s.selectOwner('user:G');mutate(s,{type:'renewal-add',lines:[{lineId:'mochi',offerId:'mochi',mode:'gift-four',flavourCounts:{strawberry:1,green_grape:1,mandarin:0,banana:1,butter_redbean:0,nama_chocolate:1},quantity:1,individualPackaging:false}]})
 assert.equal(create(storage,'user:G').getSnapshot().renewalLines[0].flavourCounts.strawberry,1)
 assert.equal(create(storage,'user:H').getSnapshot().renewalLines.length,0)
})
test('external cart changes are distinguished from local actions for Checkout review',()=>{
 const storage=memory(),a=create(storage,'user:G'),b=create(storage,'user:G');mutate(a,{type:'renewal-add',lines:[cake]})
 assert.equal(a.getSnapshot().changedInAnotherTab,false)
 mutate(b,{type:'renewal-add',lines:[chocolate]});a.refresh()
 assert.equal(a.getSnapshot().changedInAnotherTab,true);assert.equal(a.getSnapshot().renewalLines.length,2)
})
test('adding an addon to a current parent keeps the existing Renewal cart contract',()=>{
 const s=create(memory(),'user:G');mutate(s,{type:'renewal-add',lines:[cake]})
 mutate(s,{type:'renewal-add',lines:[{lineId:'cream',offerId:'addon-cream',parentLineId:'pave',quantity:1}]})
 assert.equal(s.getSnapshot().renewalLines.length,2)
 mutate(s,{type:'renewal-remove',id:'pave'});assert.equal(s.getSnapshot().renewalLines.length,0)
})
