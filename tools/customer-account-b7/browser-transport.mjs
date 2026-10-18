// Inject into the existing SDK instance in test builds only. Never ship the signing key.
export function createB7BrowserTransport({crypto,clock=Date.now,windowState,readSecret,execute}) {
 let tail=Promise.resolve(),count=0
 return request=>{
  const operation=async()=>{
   const fail=()=>{throw Error('B7_CLOSED')}
   if(request?.functionId!=='ca-test-reservation-api'||typeof request.body!=='string'||new TextEncoder().encode(request.body).length>20000||request.async===true||request.scheduledAt||count>=120)fail()
   const state=await windowState(),now=clock(),secret=readSecret()
   if(state?.enabled!==true||!Number.isSafeInteger(state.startsAt)||!Number.isSafeInteger(state.endsAt)||state.endsAt-state.startsAt>900000||now<state.startsAt||now>=state.endsAt||!Number.isFinite(now)||!/^[A-Za-z0-9_-]{43}$/.test(secret||''))fail()
   const bytes=Uint8Array.from(atob(secret.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0))
   if(bytes.length!==32)fail()
   const enc=new TextEncoder(),hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(request.body))),b=>b.toString(16).padStart(2,'0')).join('')
   const timestamp=String(now),nonce=crypto.randomUUID(),key=await crypto.subtle.importKey('raw',bytes,{name:'HMAC',hash:'SHA-256'},false,['sign'])
   const message=['B7v1','verygood-au-account-test','ca-test-reservation-api','20261018-b7-google-01',timestamp,nonce,hash].join('\n')
   const signature=btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.sign('HMAC',key,enc.encode(message))))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')
   count++
   return execute({...request,async:false,xpath:`/b7/${timestamp}/${nonce}/${hash}/${signature}`,method:'POST',headers:{'x-b7-timestamp':timestamp,'x-b7-nonce':nonce,'x-b7-signature':signature}})
  }
  const result=tail.then(operation);tail=result.catch(()=>{});return result
 }
}
