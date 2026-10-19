async (page) => {
  const check=(condition,message)=>{if(!condition)throw Error(message)}
  let actor='customer',deletions=0,passwords=0,oauth=0
  const errors=[];page.on('pageerror',error=>errors.push(error.message))
  await page.unroute('**/*')
  await page.route('**/*',route=>{
    const request=route.request(),url=new URL(request.url()),respond=(body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)})
    if(url.hostname!=='localhost')return request.resourceType()==='stylesheet'?route.fulfill({contentType:'text/css',body:''}):route.abort()
    if(!url.pathname.startsWith('/test-appwrite/v1/'))return route.continue()
    if(url.pathname.includes('/functions/')){const {action}=JSON.parse(request.postDataJSON().body);return respond({responseStatusCode:200,responseBody:JSON.stringify({ok:true,result:action==='customer-account-health'?{enabled:true,ready:true}:{status:'ready',capabilities:{cakeOrderLines:1}}})})}
    if(url.pathname.endsWith('/account/sessions/current')&&request.method()==='DELETE'){deletions++;actor=null;return respond({})}
    if(url.pathname.endsWith('/account/sessions/email')){passwords++;actor='admin';return respond({expire:'2099-01-01T00:00:00Z'})}
    if(url.pathname.includes('/account/sessions/oauth2/')){oauth++;return respond({})}
    if(url.pathname.endsWith('/account/sessions/current'))return actor?respond({userId:actor,expire:'2099-01-01T00:00:00Z'}):respond({code:401,message:'guest'},401)
    if(url.pathname.endsWith('/account'))return actor?respond({$id:actor,status:true,name:'Local Test',email:actor==='admin'?'nam9295@gmail.com':'customer@example.test',prefs:{}}):respond({code:401,message:'guest'},401)
    if(url.pathname.includes('/documents'))return respond({documents:[],total:0})
    return respond({code:404,message:'local fixture only'},404)
  })
  await page.goto('http://localhost:4173/admin/login?oauth=success')
  await page.getByText('허용된 관리자 Google 계정이 아닙니다.').waitFor()
  check(deletions===0,'admin callback removed customer session')
  const cart=await page.evaluate(()=>localStorage.getItem('verygood-au-renewal-cart-v1'))
  await page.evaluate(()=>sessionStorage.setItem('customer-test-draft-sentinel','keep'))
  await page.getByRole('button',{name:'Google로 로그인'}).click()
  await page.getByText('현재 로그인된 계정이 있습니다. 관리자 계정으로 전환하려면 먼저 로그아웃해 주세요.').waitFor()
  check(oauth===0&&deletions===0,'existing customer was linked/deleted')
  await page.getByRole('button',{name:'현재 계정에서 로그아웃'}).click()
  await page.getByText('로그아웃했습니다. 관리자 계정으로 로그인해 주세요.').waitFor()
  await page.getByLabel('이메일',{exact:true}).fill('nam9295@gmail.com')
  await page.getByLabel('비밀번호',{exact:true}).fill('synthetic-password')
  await page.getByRole('button',{name:'이메일로 로그인'}).click()
  await page.waitForURL(url=>url.pathname==='/admin')
  check(deletions===1&&passwords===1&&oauth===0,'explicit admin switch contract changed')
  check(await page.evaluate(()=>localStorage.getItem('verygood-au-renewal-cart-v1'))===cart,'admin switch changed cart')
  check(await page.evaluate(()=>sessionStorage.getItem('customer-test-draft-sentinel'))==='keep','admin switch erased draft')
  check(errors.length===0,JSON.stringify(errors))
  return {admin:'read-only checks/unauthorized callback/explicit switch/password/cart/draft passed',pageErrors:errors.length}
}
