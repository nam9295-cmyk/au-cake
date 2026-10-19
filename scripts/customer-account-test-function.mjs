// B6 only. Explicit inputs, official Owner CLI session, no dotenv, key issuance or production writes.
import {assertCustomerAccountTestTarget,CUSTOMER_ACCOUNT_TEST_COLLECTIONS} from './customer-account-test-target.mjs'
import {assertCustomerAccountTestBudget} from './provision-customer-account-test-project.mjs'
import {resolveDeployConfig,FUNCTION_SCOPES,isSecretFunctionVariable} from './reservation-api-deploy-config.mjs'
const fail=()=>{throw Error('CUSTOMER_ACCOUNT_TEST_FUNCTION_REJECTED')}
export const B6_BUILD_COMMAND='npm ci --omit=dev --include=optional && node scripts/native-smoke.mjs --linux-node22'
export function createCustomerAccountTestFunctionManager({target:input,env,cliSession,probe,transport=fetch,clock=Date.now,onEvent=()=>{}}) {
 const target=assertCustomerAccountTestTarget(input),id='ca-test-reservation-api',root='/functions/'+id
 if(target.resources.functionIds.length!==1||target.resources.functionIds[0]!==id||target.resources.databaseIds.length!==2||env?.APPWRITE_PROJECT_ID!==target.projectId||env.APPWRITE_ENDPOINT!==target.endpoint||env.APPWRITE_RESERVATION_API_FUNCTION_ID!==id||env.APPWRITE_CAKE_DATABASE_ID!=='ca_test_cake_au'||env.APPWRITE_KIDS_DATABASE_ID!=='ca_test_kids_au'||env.APPWRITE_ADMIN_USER_IDS!=='ca-test-admin-m-20261017'||env.REVIEW_ADMIN_USER_IDS!=='ca-test-admin-m-20261017'||Object.keys(env).some(k=>/^(RESEND|SMTP|VITE_|DOTENV|APPWRITE_CONTROL_|APPWRITE_CUSTOM_CAKE_)/.test(k))||env.AU_RENEWAL_WRITES_ENABLED==='true'||env.AU_RENEWAL_PREORDERS_ENABLED==='true')fail()
 const config=resolveDeployConfig(env,{customerAccountTest:true})
 for(const [key,value] of Object.entries(config.runtimeVariables))if(key.endsWith('_TABLE_ID')&&!Object.values(CUSTOMER_ACCOUNT_TEST_COLLECTIONS).flat().includes(value))fail()
 if(!cliSession||cliSession.endpoint!==target.endpoint||!cliSession.cookie||/[\r\n]/.test(cliSession.cookie)||cliSession.key||cliSession.selfSigned||typeof probe!=='function')fail()
 const variables={...config.runtimeVariables,REVIEW_ADMIN_USER_IDS:env.REVIEW_ADMIN_USER_IDS}
 let created=false,attempted=false,deployed=false,deploymentId='',busy=false,stopped=false,baselineOom,highLoadSince=null
 async function budget(){const sample=await probe();baselineOom??=sample.oomKills;({highLoadSince}=assertCustomerAccountTestBudget(sample,{baselineOom,highLoadSince,nowMs:clock()}))}
 async function request(method,path,data){
  await budget()
  const projectPath='/projects/'+target.projectId
  const allowed=method==='GET'&&[projectPath,'/functions','/functions/runtimes','/functions/specifications',root,root+'/variables',...(deploymentId?[root+'/deployments/'+deploymentId]:[])].includes(path)||method==='POST'&&[...(attempted?['/functions']:[]),...(created?[root+'/variables',root+'/deployments',root+'/executions']:[])].includes(path)||method==='PATCH'&&deploymentId&&path===root+'/deployments/'+deploymentId
  if(!allowed)fail()
  const form=data instanceof FormData
  let r
  try{r=await transport(target.endpoint+path,{method,redirect:'error',signal:AbortSignal.timeout(path.endsWith('/executions')?60000:30000),headers:{'X-Appwrite-Project':path===projectPath?'console':target.projectId,...(path===projectPath?{}:{'X-Appwrite-Mode':'admin'}),Cookie:cliSession.cookie,...(form?{}:{'Content-Type':'application/json'})},...(data===undefined?{}:{body:form?data:JSON.stringify(data)})})}catch{stopped=true;fail()}
  if(!r.ok||r.redirected||r.url&&r.url!==target.endpoint+path){onEvent({method,path,status:r.status});stopped=true;fail()}
  onEvent({method,path,status:r.status})
  try{return await r.json()}catch{stopped=true;fail()}
 }
 async function serial(fn){if(stopped||busy)fail();busy=true;try{return await fn()}catch(e){stopped=true;throw e}finally{busy=false}}
 async function assertOff(){const p=await request('GET','/projects/'+target.projectId);if(p.$id!==target.projectId||p.teamId!=='69bf44eb000f319a38a2'||p.serviceStatusForAccount!==false||p.authEmailOtp!==false||p.authUsersAuthMagicURL!==false||p.smtpEnabled!==true||p.oAuthProviders?.find(x=>x.key==='google')?.enabled!==true)fail()}
 return {
  create(){if(attempted) return Promise.reject(Error('B6_CREATE_ALREADY_ATTEMPTED'));return serial(async()=>{
   await assertOff()
   const runtimes=await request('GET','/functions/runtimes'),specs=await request('GET','/functions/specifications'),inventory=await request('GET','/functions')
   if(!runtimes.runtimes?.some(x=>x.$id==='node-22')||!specs.specifications?.some(x=>x.slug==='s-1vcpu-1gb'&&x.cpus===1&&x.memory===1024&&x.enabled===true)||inventory.total!==0||inventory.functions?.length!==0)fail()
   attempted=true
   const fn=await request('POST','/functions',{functionId:id,name:'CA TEST Reservation API B6',runtime:'node-22',execute:[],events:[],schedule:'',timeout:20,enabled:false,logging:true,entrypoint:'src/main.js',commands:B6_BUILD_COMMAND,scopes:[...FUNCTION_SCOPES],specification:'s-1vcpu-1gb'})
   if(fn.$id!==id||fn.runtime!=='node-22'||fn.enabled!==false||fn.execute?.length!==0||fn.events?.length!==0||fn.schedule!==''||fn.specification!=='s-1vcpu-1gb')fail()
   created=true
   for(const [key,value] of Object.entries(variables))await request('POST',root+'/variables',{key,value,secret:isSecretFunctionVariable(key)})
   return {functionId:id,runtime:fn.runtime,enabled:false,execute:[],specification:fn.specification,variableCount:Object.keys(variables).length}
  })},
  deploy(archive){if(!created||deployed||!Buffer.isBuffer(archive)||!archive.length||archive.length>2*1024*1024)return Promise.reject(Error('B6_ARCHIVE_REJECTED'));return serial(async()=>{
   await assertOff();deployed=true
   const data=new FormData();data.set('code',new Blob([archive],{type:'application/gzip'}),'code.tar.gz');data.set('activate','false');data.set('entrypoint','src/main.js');data.set('commands',B6_BUILD_COMMAND)
   const d=await request('POST',root+'/deployments',data);if(!/^[\w.-]{1,36}$/.test(d.$id||''))fail();deploymentId=d.$id;return d
  })},
  deployment(){if(!deploymentId)return Promise.reject(Error('B6_DEPLOYMENT_MISSING'));return serial(()=>request('GET',root+'/deployments/'+deploymentId))},
  activate(){if(!deploymentId)return Promise.reject(Error('B6_DEPLOYMENT_MISSING'));return serial(async()=>{await assertOff();const d=await request('GET',root+'/deployments/'+deploymentId);if(d.status!=='ready')fail();await request('PATCH',root+'/deployments/'+deploymentId);return request('GET',root)})},
  execute(body){if(!deploymentId||!['health','renewal-health','customer-account-health','customer-orders','customer-order','create-cake','lookup-cake','calendar-production-detail'].includes(body?.action))return Promise.reject(Error('B6_EXECUTION_REJECTED'));return serial(async()=>{await assertOff();return request('POST',root+'/executions',{body:JSON.stringify(body),async:false,method:'POST',headers:{},path:'/'})})},
  metadata(){return serial(()=>request('GET',root))},
 }
}
