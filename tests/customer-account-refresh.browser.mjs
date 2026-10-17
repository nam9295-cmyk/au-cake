async (page) => {
  const check=(condition,message)=>{if(!condition)throw Error(message)}
  const fixture=await (await page.request.get('http://localhost:4173/tests/fixtures/customer-account/browser-orders.json')).json()
  let actor='a',expired=false,ready=true,holdRestores=false,restoreStarted,holdDetail=false,detailStarted,releaseDetail,holdSave=false,saveStarted,releaseSave
  const pendingRestores=[],errors=[],calls={list:0,detail:0,save:0,logout:0},prefs={
    a:{verygoodAuCustomer:{version:1,name:'Saved A',contactEmail:'contact-a@example.test',phone:'0412345678',language:'en'}},
    b:{verygoodAuCustomer:{version:1,name:'Saved B',contactEmail:'contact-b@example.test',phone:'0498765432',language:'en'}},
  }
  page.on('pageerror',error=>errors.push(error.message))
  await page.unroute('**/*')
  await page.route('**/*',route=>{
    const request=route.request(),url=new URL(request.url())
    if(url.hostname!=='localhost')return request.resourceType()==='stylesheet'?route.fulfill({contentType:'text/css',body:''}):route.abort()
    if(!url.pathname.startsWith('/test-appwrite/v1/'))return route.continue()
    const respond=(body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)})
    const execution=result=>respond({responseStatusCode:200,responseBody:JSON.stringify({ok:true,result})})
    if(url.pathname.includes('/functions/')) {
      const {action,data}=JSON.parse(request.postDataJSON().body)
      if(action==='customer-account-health')return execution({enabled:true,ready})
      if(action==='customer-orders'){calls.list++;return execution(fixture[actor])}
      if(action==='customer-order') {
        calls.detail++
        if(holdDetail)return new Promise(resolve=>{releaseDetail=()=>resolve(execution(fixture.details[data.id]));detailStarted()})
        return execution(fixture.details[data.id])
      }
      return respond({},503)
    }
    if(url.pathname.endsWith('/account/prefs')) {
      if(request.method()==='PATCH') {
        calls.save++;const who=actor,value=request.postDataJSON().prefs
        if(holdSave)return new Promise(resolve=>{releaseSave=()=>{prefs[who]=value;resolve(respond({$id:'customer-'+who,prefs:value}))};saveStarted()})
        prefs[who]=value
      }
      return respond(prefs[actor])
    }
    if(url.pathname.endsWith('/account/sessions/current')) {
      if(request.method()==='DELETE')calls.logout++
      return respond({userId:'customer-'+actor,expire:'2099-01-01T00:00:00Z'})
    }
    if(url.pathname.endsWith('/account')) {
      const body={$id:'customer-'+actor,status:true,email:'login-'+actor+'@example.test',name:'Account '+actor,prefs:prefs[actor]}
      if(holdRestores)return new Promise(resolve=>{pendingRestores.push(()=>resolve(expired?respond({code:401},401):respond(body)));restoreStarted()})
      return expired?respond({code:401},401):respond(body)
    }
    return respond({},404)
  })
  await page.setViewportSize({width:390,height:844})
  await page.goto('http://localhost:4173/robots.txt')
  await page.evaluate(()=>{sessionStorage.clear();localStorage.removeItem('au-cake-language')})
  await page.goto('http://localhost:4173/account')
  const login=page.locator('input[name=loginEmail]'),name=page.locator('input[name=name]')
  await login.waitFor()
  async function beginRefresh() {
    holdRestores=true
    const started=new Promise(resolve=>{restoreStarted=resolve})
    await page.evaluate(()=>window.dispatchEvent(new Event('focus')))
    await started
  }
  async function finishRefresh() {
    holdRestores=false
    for(const release of pendingRestores.splice(0))await release()
    await login.waitFor({state:'visible'})
  }
  await name.fill('Unsaved A name')
  await page.locator('input[name=contactEmail]').fill('unsaved-a@example.test')
  await page.locator('input[name=phone]').fill('0411111111')
  await page.locator('select[name=language]').selectOption('ko')
  await page.getByRole('button',{name:new RegExp(fixture.a.orders[0].reservationNumber)}).click()
  await page.getByRole('region',{name:'Order details'}).waitFor()
  const reads={list:calls.list,detail:calls.detail}
  await beginRefresh();await finishRefresh()
  check(await name.inputValue()==='Unsaved A name','same-UID focus reset unsaved profile')
  check(await page.locator('input[name=contactEmail]').inputValue()==='unsaved-a@example.test','same-UID focus reset contact email')
  check(await page.locator('input[name=phone]').inputValue()==='0411111111','same-UID focus reset phone')
  check(await page.locator('select[name=language]').inputValue()==='ko','same-UID focus reset preferred language')
  check(await page.getByRole('region',{name:'Order details'}).isVisible(),'same-UID focus closed details')
  check(calls.list===reads.list&&calls.detail===reads.detail,'same-UID focus reloaded order panel')
  await page.locator('form.customer-profile-form').evaluate(element=>{window.__accountFormBeforeRefresh=element})
  await beginRefresh()
  check(await name.count()===1&&!await name.isVisible(),'pending refresh must retain a hidden panel')
  check(await name.evaluate(element=>!!element.closest('[inert]')),'pending panel remains interactive')
  await beginRefresh();await finishRefresh()
  check(await page.locator('form.customer-profile-form').evaluate(element=>element===window.__accountFormBeforeRefresh),'duplicate focus remounted panel')
  check(await name.inputValue()==='Unsaved A name','duplicate focus lost draft')

  // A detail requested before switching must never appear after B is verified.
  holdDetail=true
  const detailPending=new Promise(resolve=>{detailStarted=resolve})
  await page.getByRole('button',{name:new RegExp(fixture.a.orders[1].reservationNumber)}).click();await detailPending
  actor='b';await beginRefresh()
  check(!await name.isVisible(),'old account visible during verification')
  await finishRefresh()
  check(await name.inputValue()==='Saved B','A profile carried into B')
  check(await login.inputValue()==='login-b@example.test','A identity carried into B')
  releaseDetail();holdDetail=false
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))
  check(await page.getByText(fixture.a.orders[0].reservationNumber,{exact:true}).count()===0,'A order carried into B')
  check(await page.getByRole('region',{name:'Order details'}).count()===0,'late A detail carried into B')

  await name.fill('Unsaved B')
  await page.getByRole('button',{name:new RegExp(fixture.b.orders[0].reservationNumber)}).click()
  await page.getByRole('region',{name:'Order details'}).waitFor()
  expired=true;await page.evaluate(()=>window.dispatchEvent(new Event('focus')))
  await page.locator('main').getByRole('button',{name:'Sign in',exact:true}).waitFor()
  check(await name.count()===0&&await page.locator('.customer-order-detail').count()===0,'expired session retained private form/detail')
  expired=false;await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await login.waitFor()
  check(await name.inputValue()==='Saved B','expired draft resurfaced after sign-in')

  // A profile response cannot cancel a newer B restore that is still in flight.
  actor='a';await page.evaluate(()=>window.dispatchEvent(new Event('focus')))
  await page.waitForFunction(()=>document.querySelector('input[name=loginEmail]')?.value==='login-a@example.test')
  await name.fill('Delayed save A');holdSave=true
  const savePending=new Promise(resolve=>{saveStarted=resolve})
  await page.getByRole('button',{name:'Save details',exact:true}).click();await savePending
  actor='b';await beginRefresh();releaseSave();holdSave=false
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))
  check(!await name.isVisible(),'late A save exposed A during pending B verification')
  await finishRefresh()
  check(await login.inputValue()==='login-b@example.test'&&await name.inputValue()==='Saved B','late A save invalidated B restore')
  check(prefs.b.verygoodAuCustomer.name==='Saved B','A save changed B preferences')

  actor='a';await beginRefresh();const old=pendingRestores.shift()
  actor='b';await beginRefresh();await finishRefresh();old()
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))
  check(await login.inputValue()==='login-b@example.test','late A restore replaced B')
  await name.fill('Draft before explicit auth change')
  holdRestores=true
  const authChanged=new Promise(resolve=>{restoreStarted=resolve})
  await page.evaluate(()=>window.dispatchEvent(new Event('verygood:auth-changed')));await authChanged
  check(await name.count()===0,'explicit auth change retained the old session panel')
  await finishRefresh()
  check(await name.inputValue()==='Saved B','explicit auth change reused an old session draft')
  ready=false;await page.evaluate(()=>window.dispatchEvent(new Event('focus')))
  await page.getByText('Sign in is unavailable. You can continue as a guest.').waitFor()
  check(await name.count()===0&&await page.locator('.customer-order-detail').count()===0,'failed verification retained private data')
  check(calls.logout===0,'background verification deleted shared session')
  check(errors.length===0,JSON.stringify(errors))
  return {refresh:'same-UID draft/detail, hidden/inert checking, UID switch, expiry, stale save/restore and unavailable passed',calls,pageErrors:errors.length,browser:page.context().browser().version()}
}
