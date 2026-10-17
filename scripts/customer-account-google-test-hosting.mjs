import {isDeepStrictEqual} from 'node:util'
import {assertGoogleTestTarget} from './customer-account-google-test.mjs'
export function createGoogleTestHostingWriter({target:input,token,transport=fetch}){
 const target=assertGoogleTestTarget(input),root='/accounts/'+target.cloudflareAccountId+'/pages/projects',attempted=new Set()
 if(typeof token!=='string'||!token||/[\r\n]/.test(token))throw Error('GOOGLE_TEST_HOSTING_REJECTED')
 return async(method,path,body)=>{
  const project=path===root&&isDeepStrictEqual(body,{name:target.pagesProject,production_branch:'b3-google-test'})
  const domain=path===root+'/'+target.pagesProject+'/domains'&&isDeepStrictEqual(body,{name:new URL(target.origin).hostname})
  if(method!=='POST'||!project&&!domain||attempted.has(path))throw Error('GOOGLE_TEST_HOSTING_REJECTED')
  attempted.add(path)
  let response
  try{response=await transport('https://api.cloudflare.com/client/v4'+path,{method,redirect:'error',signal:AbortSignal.timeout(15000),headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body)})}catch{throw Error('GOOGLE_TEST_HOSTING_STOPPED')}
  if(!response.ok||response.redirected)throw Error('GOOGLE_TEST_HOSTING_STOPPED')
  const value=await response.json();if(value.success!==true)throw Error('GOOGLE_TEST_HOSTING_STOPPED');return value.result
 }
}
