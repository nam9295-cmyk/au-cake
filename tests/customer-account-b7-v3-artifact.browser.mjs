async page=>{
 page.setDefaultTimeout(10000)
 const check=(ok,label)=>{if(!ok)throw Error(label)}
 const endpoint='https://api.verygood-chocolate.com/v1',project='verygood-au-account-test'
 let calls=0,violations=0,open=false,submittedBody=''
 const errors=[],cssResponses=[]
 page.on('pageerror',e=>errors.push(e.message))
 page.on('response',r=>{if(new URL(r.url()).pathname.endsWith('.css'))cssResponses.push({status:r.status(),type:r.headers()['content-type']})})
 const secret='AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI'
 await page.unroute('**/*')
 await page.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url()),respond=(body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)})
  if(url.origin==='http://localhost:4174'){
   if(url.pathname==='/test-window.json')return respond(open?{enabled:true,startsAt:Date.now()-1000,endsAt:Date.now()+898000}:{enabled:false,startsAt:null,endsAt:null})
   return route.continue()
  }
  if(!req.url().startsWith(endpoint+'/')){violations++;return route.abort()}
  if(req.headers()['x-appwrite-project']!==project){violations++;return route.abort()}
  if(url.pathname.includes('/functions/')){
   calls++;check(open,'execution while closed');check(url.pathname==='/v1/functions/ca-test-reservation-api/executions','wrong Function target')
   const payload=req.postDataJSON(),h=payload.headers
   check(typeof h?.['x-b7-signature']==='string'&&h['x-b7-signature'].length===43,'missing signature')
   check(!JSON.stringify(payload).includes(secret),'raw signing key transmitted')
   const body=JSON.parse(payload.body)
   check(/^\/b7\//.test(payload.path)&&payload.method==='POST','missing signed execution marker')
   if(body.action==='create-cake'){submittedBody=payload.body;return respond({responseStatusCode:503,responseBody:JSON.stringify({ok:false,code:'SERVICE_UNAVAILABLE'})})}
   const result=body.action==='renewal-health'?{contractVersion:'au-renewal.2026-10.v2',pickupPolicyVersion:'au-renewal-pickup.2026-10-14.v2',enabled:true,preordersEnabled:false,weekendApproved:true}:body.action==='customer-account-health'?{enabled:true,ready:true}:body.action==='customer-orders'?{orders:[],nextCursor:null}:{}
   return respond({responseStatusCode:200,responseBody:JSON.stringify({ok:true,result})})
  }
  if(url.pathname.endsWith('/account'))return respond({$id:'6ad38e4e0ffd5f810e23',status:true,email:'local-google@example.invalid',name:'B7 TEST ONLY G',prefs:{}})
  if(url.pathname.endsWith('/account/sessions/current'))return respond({userId:'6ad38e4e0ffd5f810e23',expire:'2099-01-01T00:00:00Z'})
  if(url.pathname.endsWith('/account/prefs'))return respond({})
  return respond({documents:[],total:0})
 })
 await page.goto('http://localhost:4174/account')
 await page.getByText('Sign in is unavailable. You can continue as a guest.').waitFor()
 check(calls===0,'closed site invoked Function')
 open=true
 await page.getByLabel('Protected B7 run file',{exact:true}).setInputFiles({name:'wrong-version.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({manifestSha256:'wrong',key:secret,createBodies:[]}))})
 await page.getByLabel('B7 result',{exact:true}).filter({visible:true}).waitFor()
 await page.waitForFunction(()=>document.querySelector('[aria-label="B7 result"]').value==='B7_RUN_FILE_REJECTED')
 check(await page.getByLabel('Approved fixture',{exact:true}).isDisabled(),'invalid file retained fixture access')
 await page.getByLabel('Protected B7 run file',{exact:true}).setInputFiles({name:'synthetic-run.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({manifestSha256:'1c4245230e8bd89e72548bc0573ca158247462e93a8b427cdaa175d84b4d7c90',key:secret,createBodies:Array.from({length:6},(_,i)=>JSON.stringify({action:'create-cake',data:{requestId:'b700000'+(i+1)+'-0000-4000-8000-000000000001'}}))}))})
 await page.waitForFunction(()=>document.querySelector('[aria-label="B7 result"]').value==='Protected run file loaded')
 await page.getByRole('button',{name:'Use key in this tab'}).click()
 await page.waitForFunction(()=>document.querySelector('[aria-label="Test signing key"]').value==='')
 check(await page.getByLabel('Test signing key',{exact:true}).inputValue()==='','key not cleared after use')
 await page.locator('input[name=loginEmail]').waitFor()
 check(await page.locator('input[name=loginEmail]').inputValue()==='local-google@example.invalid','actual compiled auth target/config unavailable')
 // Profile renders before the asynchronous order request finishes signing/loading.
 await page.getByText('No orders in this group.',{exact:true}).first().waitFor()
 check(calls>=2,'actual compiled account/order paths were not exercised')
 await page.getByRole('button',{name:'Read test identity',exact:true}).click()
 await page.waitForFunction(()=>{try{return JSON.parse(document.querySelector('[aria-label="B7 result"]').value).userId==='6ad38e4e0ffd5f810e23'}catch{return false}})
 check(JSON.parse(await page.getByLabel('B7 result',{exact:true}).inputValue()).userId==='6ad38e4e0ffd5f810e23','identity diagnostic failed')
 await page.getByLabel('Approved B7 request',{exact:true}).fill(JSON.stringify({action:'health'}))
 await page.getByRole('button',{name:'Execute approved request',exact:true}).click()
 await page.waitForFunction(()=>{try{return JSON.parse(document.querySelector('[aria-label="B7 result"]').value).status===200}catch{return false}})
 // Synthetic cart only; the original checkout generates its own UUID and submit body.
 await page.evaluate(()=>localStorage.setItem('verygood-au-renewal-cart-v1',JSON.stringify({version:1,lines:[{lineId:'b7-native-line',offerId:'pave-cake',size:'6in',chocolateType:'dark',quantity:1}]})))
 await page.goto('http://localhost:4174/cart')
 await page.locator('input[name=name]').fill('B7 TEST ONLY G')
 await page.locator('input[name=phone]').fill('0400000001')
 await page.locator('input[name=email]').fill('b7-g@example.invalid')
 await page.locator('input[type=date]').fill('2026-10-23')
 await page.locator('form.renewal-checkout select').selectOption('10:00')
 await page.locator('input[name=privacy]').check()
 await page.getByRole('button',{name:'Read native member wire body',exact:true}).click()
 const wire=await page.getByLabel('Synthetic Checkout draft').inputValue()
 const originalId=JSON.parse(wire).data.requestId
 await page.waitForFunction(()=>!document.querySelector('form.renewal-checkout > button').disabled)
 await page.getByRole('button',{name:'Send request',exact:true}).click()
 await page.getByRole('alert').waitFor()
 check(submittedBody===wire,'native UUID/body changed between capture and original SDK submit')
 await page.getByRole('button',{name:'Preserve draft and reload',exact:true}).click()
 await page.locator('input[name=name]').waitFor()
 await page.getByRole('button',{name:'Read native member wire body',exact:true}).click()
 const restored=JSON.parse(await page.getByLabel('Synthetic Checkout draft').inputValue())
 check(restored.data.requestId===originalId,'native UUID lost after draft restore')
 check(restored.data.customerEmail==='b7-g@example.invalid','draft contact overwritten')
 check(errors.length===0,'compiled artifact page errors: '+errors.join(';'))
 check(cssResponses.length>0&&cssResponses.every(r=>r.status===200&&r.type?.includes('text/css')),'CSS status/MIME failure')
 check(violations===0,'non-test destination attempted')
 return {closedCalls:0,nativeWireAndRestore:true,pageErrors:errors.length,signedMockExecutions:calls,wrongTargetRequests:violations,providerAuthentication:'NOT RUN — all external requests intercepted'}
}
