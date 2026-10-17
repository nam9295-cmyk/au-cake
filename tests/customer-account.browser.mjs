async (page) => {
  const check=(condition,message)=>{if(!condition)throw Error(message)}
  const fixture=await (await page.request.get('http://localhost:4173/tests/fixtures/customer-account/browser-orders.json')).json()
  let actor='a',unauthorized=false,holdNext=false,holdInitial=false,releaseNext,releaseInitial,initialStarted,logoutRequests=0
  const errors=[],prefs={a:{unrelated:'keep',verygoodAuCustomer:{version:1,name:'Saved Name',contactEmail:'profile-a@example.test',phone:'0412345678',language:'en'}},b:{verygoodAuCustomer:{version:1,name:'Customer B',contactEmail:'profile-b@example.test',phone:'0498765432',language:'ko'}}}
  page.on('pageerror',error=>errors.push(error.message))
  await page.unroute('**/*')
  await page.route('**/*',async route=>{
    const request=route.request(),url=new URL(request.url())
    const respond=(body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)})
    const execution=(result,status=200,code)=>respond({responseStatusCode:status,responseBody:JSON.stringify(status===200?{ok:true,result}:{ok:false,code})})
    if(url.hostname!=='localhost')return request.resourceType()==='stylesheet'?route.fulfill({contentType:'text/css',body:''}):route.abort()
    if(!url.pathname.startsWith('/test-appwrite/v1/'))return route.continue()
    if(url.pathname.includes('/functions/')){
      const {action,data}=JSON.parse(request.postDataJSON().body)
      if(action==='customer-account-health')return execution({enabled:true,ready:true})
      if(action==='customer-orders'){
        if(unauthorized)return execution(null,401,'CUSTOMER_UNAUTHORIZED')
        if(data?.cursor&&holdNext)return new Promise(resolve=>{releaseNext=()=>resolve(execution({orders:[{...fixture.a.orders[1],id:'a-next',reservationNumber:'NEXT-PAGE-ORDER'}],nextCursor:null}))})
        if(actor==='a'&&holdInitial)return new Promise(resolve=>{releaseInitial=()=>resolve(execution(fixture.a));initialStarted?.()})
        return execution(fixture[actor])
      }
      if(action==='customer-order')return execution(fixture.details[data.id])
      return execution(null,503,'SERVICE_UNAVAILABLE')
    }
    if(url.pathname.endsWith('/account/prefs')){
      if(request.method()==='PATCH')prefs[actor]=request.postDataJSON().prefs
      return respond(request.method()==='PATCH'?{$id:'customer-'+actor,prefs:prefs[actor]}:prefs[actor])
    }
    if(url.pathname.endsWith('/account/sessions/current')){if(request.method()==='DELETE')logoutRequests++;return respond({userId:'customer-'+actor,expire:'2099-01-01T00:00:00Z'})}
    if(url.pathname.endsWith('/account'))return respond({$id:'customer-'+actor,status:true,email:'login-'+actor+'@example.test',name:'Account '+actor,prefs:prefs[actor]})
    return respond({code:404,message:'offline test only'},404)
  })
  await page.setViewportSize({width:1440,height:900})
  await page.goto('http://localhost:4173/account')
  await page.evaluate(()=>{localStorage.removeItem('au-cake-language');sessionStorage.clear()});await page.reload()
  await page.locator('input[name=loginEmail]').waitFor()
  check(await page.locator('input[name=loginEmail]').getAttribute('readonly')!==null,'login email editable')
  await page.locator('input[name=name]').fill('New Profile Name')
  await page.locator('input[name=contactEmail]').fill('new-contact@example.test')
  await page.getByRole('button',{name:'Save details'}).click()
  await page.getByText('Saved. These details will be available for your next order.').waitFor()
  check(prefs.a.unrelated==='keep'&&prefs.a.verygoodAuCustomer.contactEmail==='new-contact@example.test','prefs overwritten/login-contact confused')
  check(await page.locator('input[name=loginEmail]').inputValue()==='login-a@example.test','login email changed')
  await page.getByRole('button',{name:new RegExp(fixture.a.orders[0].reservationNumber)}).click()
  await page.getByRole('region',{name:'Order details'}).waitFor()
  check((await page.getByRole('region',{name:'Order details'}).innerText()).includes('82.00'),'historical order repriced')
  check(!(await page.getByRole('region',{name:'Order details'}).innerText()).includes('new-contact@example.test'),'profile changed historical snapshot')
  holdNext=true
  await page.getByRole('button',{name:'Load more orders'}).click()
  await page.getByRole('button',{name:new RegExp(fixture.a.orders[1].reservationNumber)}).click()
  await page.getByRole('heading',{name:fixture.a.orders[1].reservationNumber,exact:true}).waitFor()
  const response=page.waitForResponse(res=>{try{return JSON.parse(res.request().postDataJSON().body).data?.cursor==='a-legacy'}catch{return false}})
  releaseNext();await response
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))
  check(await page.getByText('NEXT-PAGE-ORDER',{exact:true}).count()===1,'details request discarded pagination or left loading stuck')
  await page.getByRole('button',{name:'EN',exact:true}).click()
  holdInitial=true
  const started=new Promise(resolve=>{initialStarted=resolve})
  await page.goto('http://localhost:4173/account')
  await page.locator('input[name=loginEmail]').waitFor()
  await started
  actor='b';await page.evaluate(()=>window.dispatchEvent(new Event('verygood:auth-changed')))
  await page.getByRole('button',{name:new RegExp(fixture.b.orders[0].reservationNumber)}).waitFor()
  releaseInitial();await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))
  check(await page.locator('input[name=loginEmail]').inputValue()==='login-b@example.test','old identity remained')
  check(await page.getByText(fixture.a.orders[0].reservationNumber,{exact:true}).count()===0,'late A orders appeared for B')
  check(await page.getByRole('heading',{name:'Upcoming Orders',exact:true}).count()===1,'saved KO reversed explicit EN choice')
  unauthorized=true
  await page.evaluate(()=>window.dispatchEvent(new Event('verygood:auth-changed')))
  await page.getByText('Sign in is unavailable. You can continue as a guest.').waitFor()
  check(await page.locator('input[name=loginEmail]').count()===0,'401 retained old identity')
  check(logoutRequests===0,'401 silently deleted shared session')
  check(errors.length===0,JSON.stringify(errors))
  return {account:'profile/read-only login/stored prices/pagination/detail/A-B/401/language passed',pageErrors:errors.length}
}
