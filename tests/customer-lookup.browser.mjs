async (page) => {
  const check=(condition,message)=>{if(!condition)throw Error(message)}
  const projection=(await (await page.request.get('http://localhost:4173/tests/fixtures/customer-account/renewal-browser-projections.json')).json())[1]
  const errors=[],requests=[];let accountCalls=0
  page.on('pageerror',error=>errors.push(error.message))
  await page.unroute('**/*')
  await page.route('**/*',route=>{
    const request=route.request(),url=new URL(request.url())
    if(url.hostname!=='localhost')return request.resourceType()==='stylesheet'?route.fulfill({contentType:'text/css',body:''}):route.abort()
    if(!url.pathname.startsWith('/test-appwrite/v1/'))return route.continue()
    const respond=(body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)})
    if(url.pathname.includes('/functions/')) {
      const body=JSON.parse(request.postDataJSON().body)
      if(body.action==='customer-account-health')return respond({responseStatusCode:200,responseBody:'{"ok":true,"result":{"enabled":true,"ready":false}}'})
      check(body.action==='lookup-cake','guest lookup depended on member API')
      requests.push(body)
      const found=body.data.reservationNumber==='LOCAL-TEST-ORDER'&&body.data.phone==='0412345678'
      return respond({responseStatusCode:found?200:404,responseBody:JSON.stringify(found?{ok:true,result:projection}:{ok:false,code:'NOT_FOUND'})})
    }
    if(url.pathname.includes('/account'))accountCalls++
    return respond({code:404},404)
  })
  await page.setViewportSize({width:390,height:844})
  await page.goto('http://localhost:4173/robots.txt')
  await page.evaluate(()=>{sessionStorage.clear();localStorage.setItem('au-cake-language','en')})
  await page.goto('http://localhost:4173/lookup')
  const form=page.locator('form.lookup-form')
  await form.locator('input').nth(0).fill('LOCAL-TEST-ORDER')
  await form.locator('input').nth(1).fill('0412345678')
  await form.locator('button[type=submit]').click()
  await page.locator('.result-panel').waitFor()
  check((await page.locator('.result-panel').innerText()).includes('107'),'guest lookup changed stored total')
  check(requests.length===1&&Object.keys(requests[0].data).sort().join(',')==='phone,reservationNumber'&&!requests[0].customerAccount,'guest lookup required account identity')
  await form.locator('input').nth(1).fill('0499999999')
  await form.locator('button[type=submit]').click()
  await page.getByText('We could not find that booking.').waitFor()
  check(await page.locator('.result-panel').count()===0,'failed lookup retained prior result')
  check(accountCalls===0,'unsafe customer readiness invoked Account during guest lookup')
  check(errors.length===0,JSON.stringify(errors))
  return {guestLookup:'reservation number/full phone with unavailable customer auth and failed-result clearing passed',requests:requests.length,accountCalls,pageErrors:errors.length}
}
