async (page) => {
  const check=(condition,message)=>{if(!condition)throw Error(message)}
  const errors=[],submissions=[];let accountCalls=0,externalRequests=0
  const projections=await (await page.request.get('http://localhost:4173/tests/fixtures/customer-account/renewal-browser-projections.json')).json()
  page.on('pageerror',error=>errors.push(error.message))
  await page.unroute('**/*')
  await page.route('**/*',route=>{
    const request=route.request(),url=new URL(request.url())
    if(url.hostname!=='localhost'){externalRequests++;return request.resourceType()==='stylesheet'?route.fulfill({contentType:'text/css',body:''}):route.abort()}
    const respond=(body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)})
    if(url.pathname.startsWith('/test-appwrite/v1/account')){accountCalls++;return respond({code:503},503)}
    if(url.pathname.includes('/functions/')) {
      const body=JSON.parse(request.postDataJSON().body)
      if(body.action==='create-cake')submissions.push(body)
      const result=body.action==='renewal-health'?{contractVersion:'au-renewal.2026-10.v2',pickupPolicyVersion:'au-renewal-pickup.2026-10-14.v2',enabled:true,preordersEnabled:false,weekendApproved:true}:body.action==='create-cake'?{...projections[1],pickupDate:body.data.pickupDate,pickupTime:body.data.pickupTime}:null
      check(result!==null,'disabled customer health/read was called')
      return respond({responseStatusCode:200,responseBody:JSON.stringify({ok:true,result})})
    }
    if(url.pathname.startsWith('/test-appwrite/'))return respond({code:404},404)
    return route.continue()
  })
  await page.goto('http://localhost:4175/robots.txt')
  const ids=await page.evaluate(()=>{
    const flowId=crypto.randomUUID(),requestId=crypto.randomUUID(),savedAt=Date.now(),returnTo='/cart'
    const cart={version:1,lines:[{lineId:'line-a',offerId:'pave-cake',quantity:1,size:'8in',finish:'basic',chocolateType:'dark',individualPackaging:false}]},signature=JSON.stringify(cart)
    localStorage.setItem('verygood-au-renewal-cart-v1',signature)
    localStorage.setItem('au-cake-language','en');sessionStorage.clear()
    sessionStorage.setItem('verygood-au-customer-return-v1:'+flowId,JSON.stringify({version:1,flowId,savedAt,returnTo}))
    sessionStorage.setItem('verygood-au-customer-checkout-v1:'+flowId,JSON.stringify({version:1,kind:'renewal',flowId,requestId,savedAt,returnTo,form:{name:'Preserved Guest',phone:'0412345678',email:'guest@example.test',date:'2099-11-01',time:'09:00',note:'OAuth rollback draft',promo:'KEPT',privacy:true},dirtyFields:['name','email'],checkoutContext:{},cartSnapshot:cart.lines,cartSignature:signature}))
    return {flowId,requestId,signature}
  })
  const response=await page.goto(`http://localhost:4175/account/auth/callback?flowId=${ids.flowId}&error=cancelled`)
  check(response.status()===200,'callback direct load failed')
  await page.waitForURL(url=>url.pathname==='/cart'&&!url.searchParams.has('customerResume'))
  await page.locator('form.renewal-checkout').waitFor()
  check(await page.locator('input[name=name]').inputValue()==='Preserved Guest','OFF callback lost form')
  check(await page.locator('input[name=promo]').inputValue()==='KEPT','OFF callback lost coupon')
  check(await page.locator('textarea[name=note]').inputValue()==='OAuth rollback draft','OFF callback lost note')
  check(await page.locator('input[name=privacy]').isChecked(),'OFF callback lost consent')
  check(await page.evaluate(()=>localStorage.getItem('verygood-au-renewal-cart-v1'))===ids.signature,'OFF callback changed cart')
  check(await page.getByRole('button',{name:'Sign in',exact:true}).count()===0,'OFF exposes customer sign-in')
  await page.waitForFunction(()=>!document.querySelector('form.renewal-checkout > button').disabled)
  await page.getByRole('button',{name:'Send request',exact:true}).click()
  await page.getByRole('heading',{name:'Request received'}).waitFor()
  check(submissions.length===1&&submissions[0].data.requestId===ids.requestId&&!submissions[0].customerAccount,'OFF guest request/identity incorrect')
  await page.goto('http://localhost:4175/account')
  await page.getByText('Customer accounts are currently unavailable. Guest ordering is available.').waitFor()
  check(await page.locator('meta[name=robots]').getAttribute('content')==='noindex, nofollow','account lost noindex')
  check(accountCalls===0&&errors.length===0,'OFF performed Account call or JS error')
  return {disabled:'built direct callback→draft/cart/coupon/requestId→guest submit and account noindex passed',accountCalls,pageErrors:errors.length,blockedExternalRequests:externalRequests}
}
