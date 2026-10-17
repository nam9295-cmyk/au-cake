async (page) => {
  const check=(condition,message)=>{if(!condition)throw Error(message)}
  await page.setViewportSize({width:390,height:844})
  const errors=[],submissions=[],drafts=[]
  let signedIn=false,oauth='cancel',otpFail=false,failOrder=false,productionRequests=0,oauthVisits=0
  let oauthCallback=''
  const fixtureResponse=await page.request.get('http://localhost:4173/tests/fixtures/customer-account/renewal-browser-projections.json')
  const projections=await fixtureResponse.json()
  await page.addInitScript(()=>{
    const original=Storage.prototype.setItem
    Storage.prototype.setItem=function(key,value){
      if(key.startsWith('verygood-au-customer-checkout-v1:')&&window.__customerDenyDraft)throw new DOMException('Local test quota','QuotaExceededError')
      const result=original.call(this,key,value)
      if(location.hostname==='localhost'&&key.startsWith('verygood-au-customer-checkout-v1:'))original.call(sessionStorage,'__customer-account-test-draft',value)
      return result
    }
  })
  page.on('pageerror',error=>errors.push(error.message))
  await page.unroute('**/*')
  await page.route('**/*',async route=>{
    const request=route.request(),url=new URL(request.url())
    if(url.hostname!=='localhost') {
      if(/appwrite|verygood|resend/.test(url.hostname))productionRequests++
      return request.resourceType()==='stylesheet'?route.fulfill({contentType:'text/css',body:''}):route.abort()
    }
    const respond=(body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)})
    if(!url.pathname.startsWith('/test-appwrite/v1/'))return route.continue()
    if(url.pathname.includes('/functions/')) {
      const body=request.postDataJSON();const {action,data}=JSON.parse(body.body)
      let result
      if(action==='customer-account-health')result={enabled:true,ready:true}
      else if(action==='renewal-health')result={contractVersion:'au-renewal.2026-10.v2',pickupPolicyVersion:'au-renewal-pickup.2026-10-14.v2',enabled:true,preordersEnabled:false,weekendApproved:true}
      else if(action==='create-cake') {
        submissions.push(JSON.parse(body.body))
        if(failOrder)return respond({responseStatusCode:503,responseBody:'{"ok":false,"code":"SERVICE_UNAVAILABLE"}'})
        result={...projections[data.orderLines[0].quantity],pickupDate:data.pickupDate,pickupTime:data.pickupTime}
      } else if(action==='health')result={status:'ready',capabilities:{cakeOrderLines:1,chocolateOrderLines:1}}
      else return respond({responseStatusCode:400,responseBody:'{"ok":false,"code":"INVALID_CUSTOMER_REQUEST"}'})
      return respond({responseStatusCode:200,responseBody:JSON.stringify({ok:true,result})})
    }
    if(url.pathname.endsWith('/account/sessions/oauth2/google')) {
      oauthVisits++
      const callback=url.searchParams.get(oauth==='success'?'success':'failure')
      signedIn=oauth==='success';oauthCallback=callback+(signedIn?'':'&error=cancelled')
      return route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><html><head><link rel="icon" href="data:,"></head><body>Isolated OAuth test provider</body></html>'})
    }
    if(url.pathname.endsWith('/account/tokens/email'))return otpFail?respond({code:429,message:'provider-private-details'},429):respond({userId:'customer-a',expire:'2099-01-01T00:00:00Z'})
    if(url.pathname.endsWith('/account/sessions/token')){signedIn=true;return respond({userId:'customer-a',expire:'2099-01-01T00:00:00Z'})}
    if(url.pathname.endsWith('/account/sessions/current')&&request.method()==='DELETE'){signedIn=false;return respond({})}
    if(url.pathname.endsWith('/account/sessions/current'))return signedIn?respond({userId:'customer-a',expire:'2099-01-01T00:00:00Z'}):respond({code:401,message:'guest'},401)
    if(url.pathname.endsWith('/account'))return signedIn?respond({$id:'customer-a',status:true,email:'login@example.test',name:'Google Name',prefs:{verygoodAuCustomer:{version:1,name:'Saved Name',contactEmail:'saved-contact@example.test',phone:'0412345678',language:'en'}}}):respond({code:401,message:'guest'},401)
    if(url.pathname.includes('/settings/'))return respond({code:404,message:'no local settings'},404)
    return respond({code:404,message:'offline-only test endpoint'},404)
  })
  async function bag() {
    // Seed on an inert same-origin document, before CartProvider's initial persistence effect.
    await page.goto('http://localhost:4173/robots.txt')
    await page.evaluate(()=>{localStorage.setItem('verygood-au-renewal-cart-v1',JSON.stringify({version:1,lines:[{lineId:'line-a',offerId:'pave-cake',size:'8in',quantity:1}]}));sessionStorage.clear()})
    await page.goto('http://localhost:4173/cart');await page.locator('form.renewal-checkout').waitFor()
    await page.locator('input[name=name]').fill('Already typed')
    await page.locator('input[name=phone]').fill('0412345678')
    await page.locator('input[name=email]').fill('typed-contact@example.test')
    await page.locator('input[type=date]').fill('2099-11-01')
    await page.locator('select').selectOption('13:00')
    await page.locator('input[name=promo]').fill('SAVED')
    await page.locator('textarea[name=note]').fill('Keep my note')
    await page.locator('input[name=privacy]').check()
  }
  async function signInGoogle() {
    await page.getByRole('button',{name:'Sign in',exact:true}).click()
    await page.getByRole('button',{name:'Continue with Google'}).click()
    await page.waitForURL(url=>url.pathname.endsWith('/account/sessions/oauth2/google'))
    drafts.push(await page.evaluate(()=>JSON.parse(sessionStorage.getItem('__customer-account-test-draft'))))
    if(oauth==='changed') {
      const other=await page.context().newPage()
      await other.goto('http://localhost:4173/robots.txt')
      await other.evaluate(()=>localStorage.setItem('verygood-au-renewal-cart-v1',JSON.stringify({version:1,lines:[{lineId:'line-a',offerId:'pave-cake',size:'8in',quantity:2}]})))
      await other.close()
    }
    await page.goto(oauthCallback)
    await page.waitForURL(url=>url.pathname==='/cart'&&!url.searchParams.has('customerResume'))
    await page.locator('input[name=name]').waitFor()
  }
  for(const mode of ['cancel','success','changed']) {
    oauth=mode;signedIn=false;await bag();await signInGoogle()
    const draft=drafts.at(-1)
    check(draft?.form.name==='Already typed'&&draft.form.promo==='SAVED','actual Bag not captured')
    check(await page.locator('input[name=name]').inputValue()==='Already typed','OAuth replaced typed name')
    check(await page.locator('input[name=email]').inputValue()==='typed-contact@example.test','OAuth replaced order email')
    check(await page.locator('textarea[name=note]').inputValue()==='Keep my note','OAuth lost note')
    check(await page.locator('input[type=date]').inputValue()==='2099-11-01'&&await page.locator('select').inputValue()==='13:00','OAuth lost the approved weekend closing pickup')
    check(await page.locator('input[name=privacy]').isChecked(),'OAuth changed consent')
    if(mode==='changed') {
      check(await page.getByRole('button',{name:'Send request',exact:true}).isDisabled(),'changed cart can submit')
      check((await page.evaluate(()=>JSON.parse(localStorage.getItem('verygood-au-renewal-cart-v1')).lines[0].quantity))===2,'newer other-tab cart overwritten')
      await page.getByRole('button',{name:'I have reviewed the current bag'}).click()
    }
    await page.waitForFunction(()=>!document.querySelector('form.renewal-checkout > button').disabled)
    await page.getByRole('button',{name:'Send request',exact:true}).click()
    await page.getByRole('heading',{name:'Request received'}).waitFor()
    const sent=submissions.at(-1)
    check(mode==='changed'?sent.data.requestId!==draft.requestId:sent.data.requestId===draft.requestId,'requestId restore/changed-cart confirmation incorrect')
    check((sent.customerAccount==='link')===(mode==='success'),'guest/member marker incorrect')
    check(sent.data.customerEmail==='typed-contact@example.test','login email replaced order email')
    check(sent.data.pickupTime==='13:00','weekend closing pickup changed before submission')
    check(sent.data.orderLines[0].quantity===(mode==='changed'?2:1),'submitted stale cart')
  }
  signedIn=false;await bag()
  await page.getByRole('button',{name:'Sign in',exact:true}).click()
  signedIn=true
  await page.getByRole('button',{name:'Continue as Guest',exact:true}).last().click()
  const restoredSession=page.waitForResponse(response=>response.url().endsWith('/account/sessions/current')&&response.request().method()==='GET')
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')))
  await restoredSession
  await page.waitForFunction(()=>!document.querySelector('form.renewal-checkout > button').disabled)
  await page.getByRole('button',{name:'Send request',exact:true}).click();await page.getByRole('heading',{name:'Request received'}).waitFor()
  check(!submissions.at(-1).customerAccount,'explicit dialog guest choice ignored when valid session restored')
  signedIn=false;otpFail=true;failOrder=true;await bag()
  await page.waitForFunction(()=>!document.querySelector('form.renewal-checkout > button').disabled)
  await page.getByRole('button',{name:'Send request',exact:true}).click()
  await page.getByRole('alert').waitFor();const ambiguous=submissions.at(-1).data.requestId,count=submissions.length
  await page.getByRole('button',{name:'Sign in',exact:true}).click()
  await page.getByLabel('Email address').fill('buyer@example.test')
  await page.getByRole('button',{name:'Continue with Email'}).click()
  await page.getByText('Please wait before requesting another code.').waitFor()
  await page.getByRole('button',{name:'Continue as Guest',exact:true}).last().click()
  check(submissions.length===count,'auth failure auto-resubmitted ambiguous order')
  failOrder=false
  await page.getByRole('button',{name:'Send request',exact:true}).click();await page.getByRole('heading',{name:'Request received'}).waitFor()
  check(submissions.at(-1).data.requestId===ambiguous,'explicit retry lost requestId')
  check(!submissions.at(-1).customerAccount,'OTP failure prevented guest retry')
  signedIn=false;await bag()
  await page.evaluate(()=>{window.__customerDenyDraft=true})
  const visits=oauthVisits
  await page.getByRole('button',{name:'Sign in',exact:true}).click()
  await page.getByRole('button',{name:'Continue with Google'}).click()
  await page.getByText('Sign in could not be completed. Try again or continue as a guest.').waitFor()
  check(new URL(page.url()).pathname==='/cart'&&oauthVisits===visits,'left checkout after draft storage failure')
  check(await page.locator('input[name=name]').inputValue()==='Already typed','storage failure erased form')
  check(errors.length===0,JSON.stringify(errors));check(productionRequests===0,'production request attempted')
  return {actualBag:'OAuth cancel/success, explicit guest, newer other-tab cart, OTP failure, ambiguous retry and storage failure passed',submissions:submissions.length,pageErrors:errors.length,productionRequests}
}
