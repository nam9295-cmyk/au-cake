import {writeFile,rename,access} from 'node:fs/promises'
import {spawn} from 'node:child_process'
import {pathToFileURL,fileURLToPath} from 'node:url'
import {resolve,join} from 'node:path'
import {createGoogleOnlyTestManager,GOOGLE_TEST_TARGET,assertGoogleTestTarget} from './customer-account-google-test.mjs'
import {readGoogleOnlyPrivateJson} from './customer-account-google-only-live.mjs'
import {googleOnlyErrorReason,safeGoogleOnlyReason,googleOnlyDiagnosticError} from './customer-account-google-only-diagnostics.mjs'
import {createGoogleOnlyDiagnosticWriter} from './customer-account-google-only-watchdog.mjs'
import {GOOGLE_ONLY_USERS} from '../tools/customer-account-google-only/contract.mjs'
import {assertManualCartMode} from '../tools/customer-account-cart-manual/contract.mjs'
import {createManualCartPages,assertManualCartBudget} from './build-customer-account-cart-manual.mjs'
const fail=()=>{throw Error('MANUAL_CART_UNVERIFIED')}
export function manualCartEmergencyReason(state,journal,at=Date.now()){
 if(!Number.isFinite(at)||at<journal.startedAt)return {code:'CLOCK_INVALID',stage:'worker'}
 const opening=journal.phase==='opening'&&Number.isSafeInteger(journal.openingAt)&&at>=journal.openingAt&&at-journal.openingAt<=8000
 for(const [id,sessions] of Object.entries(state.sessions))for(const s of sessions){
  if(!Object.values(GOOGLE_ONLY_USERS).some(u=>u.id===id)||s.userId!==id)return {code:'SESSION_USER_NOT_ALLOWED',stage:'session-attribution'}
  if(s.provider!=='google')return {code:'SESSION_PROVIDER_MISMATCH',stage:'session-attribution'}
  const t=Date.parse(s.createdAt)
  if(!Number.isFinite(t)||t<journal.startedAt||t>at)return {code:'SESSION_OUTSIDE_WINDOW',stage:'session-attribution'}
 }
 if(!opening&&state.accountEnabled!==(journal.phase==='open'&&journal.accountOn===true))return {code:'ACCOUNT_STATE_MISMATCH',stage:'account-state'}
 return null
}
export async function probeManualCartState({inspect,readJournal,clock=Date.now}){
 let before=await readJournal()
 for(let samples=1;samples<=2;samples++){
  const state=await inspect(),after=await readJournal(),reason=manualCartEmergencyReason(state,after,clock())
  // Never discard an unsafe session, clock failure, API error or stable mismatch.
  if(reason&&reason.code!=='ACCOUNT_STATE_MISMATCH')return {state,reason,samples}
  if(JSON.stringify(before)===JSON.stringify(after))return {state,reason,samples}
  const phases=['prepared','opening','open']
  const advancing=before.kind==='MANUAL_CART'&&after.kind===before.kind&&after.runId===before.runId&&after.startedAt===before.startedAt&&phases.indexOf(before.phase)>=0&&phases.indexOf(after.phase)>phases.indexOf(before.phase)
  if(!advancing||samples===2)return {state,reason:{code:'JOURNAL_INVALID',stage:'journal'},samples}
  // A project GET made before Account ON cannot be compared with a later open
  // journal. Take one fresh sample; all original predicates still apply.
  before=after
 }
}
export async function probeManualCartWithNetworkRecovery({probe,pause=ms=>new Promise(r=>setTimeout(r,ms)),onTransient=()=>{},shouldStop=()=>false}){
 for(let networkAttempts=1;networkAttempts<=3;networkAttempts++){
  if(await shouldStop())throw googleOnlyDiagnosticError('STOP_MARKER','worker')
  try{return {...await probe(),networkAttempts}}
  catch(error){
   const reason=googleOnlyErrorReason(error,{code:'PROBE_EXCEPTION',stage:'probe'})
   // Only failed read probes are repeated. Confirmed policy/session drift,
   // owner denial, journal errors and all writes keep their immediate stop.
   if(!['API_NETWORK_EXCEPTION','API_TIMEOUT'].includes(reason.code)||networkAttempts===3)throw error
   await onTransient(reason,networkAttempts)
   await pause(2000)
  }
 }
}
export function createManualCartManager({target:input,cliSession,transport=fetch,clock=Date.now,expectedBaseline,onDiagnostic}){
 const target=assertGoogleTestTarget(input),manager=createGoogleOnlyTestManager({target,cliSession,transport,clock,expectedBaseline,onDiagnostic});let attempted=false
 async function mutate(method,path,data,consoleMode=false){
  if(!(method==='PATCH'&&path==='/projects/'+target.projectId+'/service'&&data?.service==='account'&&typeof data.status==='boolean')&&!(method==='DELETE'&&Object.values(GOOGLE_ONLY_USERS).some(u=>path.startsWith('/users/'+u.id+'/sessions/'))&&/^[-\w.]{1,36}$/.test(path.split('/').at(-1))))fail()
  let r;try{r=await transport(target.endpoint+path,{method,redirect:'error',signal:AbortSignal.timeout(4500),headers:{'X-Appwrite-Project':consoleMode?'console':target.projectId,...(consoleMode?{}:{'X-Appwrite-Mode':'admin'}),Cookie:cliSession.cookie,'Content-Type':'application/json'},...(data?{body:JSON.stringify(data)}:{})})}catch{fail()}
  if(!r.ok||r.redirected)fail()
 }
 return {
  inspect:manager.inspect,stop:manager.stop,
  async open(proof){
   const {openSlot}=assertManualCartBudget(proof)
   if(attempted||proof.httpsVerified!==true||proof.monitorVerified!==true||proof.pagesUsed!==openSlot||proof.closedReserved!==true)fail()
   assertManualCartMode({enabled:true,mode:'manual-cart',runId:proof.runId,startedAt:proof.startedAt},{now:clock()})
   const before=await manager.inspect();if(before.accountEnabled||Object.values(before.sessions).some(s=>s.length))fail()
   attempted=true;await mutate('PATCH','/projects/'+target.projectId+'/service',{service:'account',status:true},true)
   const after=await manager.inspect();if(!after.accountEnabled)fail();return after
  },
  async cleanup(startedAt){
   if(!Number.isSafeInteger(startedAt)||startedAt>clock())fail()
   const state=await manager.inspect()
   for(const [id,sessions] of Object.entries(state.sessions))for(const s of sessions){
    if(!Object.values(GOOGLE_ONLY_USERS).some(u=>u.id===id)||s.userId!==id||s.provider!=='google'||!Number.isFinite(Date.parse(s.createdAt))||Date.parse(s.createdAt)<startedAt||Date.parse(s.createdAt)>clock())fail()
    await mutate('DELETE','/users/'+id+'/sessions/'+s.id)
   }
  },
 }
}
async function context(configPath,{transport=fetch,runPages}={}){
 const c=await readGoogleOnlyPrivateJson(configPath)
 if(c.kind!=='MANUAL_CART'||c.startAuthorized!==true||resolve(c.directory)!==c.directory)fail()
 assertManualCartMode({enabled:true,mode:'manual-cart',runId:c.runId,startedAt:c.startedAt},{now:c.startedAt})
 const [cliSession,baseline,proof]=await Promise.all([readGoogleOnlyPrivateJson(c.cliSessionPath),readGoogleOnlyPrivateJson(c.baselinePath),readGoogleOnlyPrivateJson(c.approvalProofPath)])
 const {priorPagesUsed}=assertManualCartBudget(proof)
 if(proof.runId!==c.runId||proof.startedAt!==c.startedAt||baseline.functionExecutionsUsed!==8||baseline.pagesUsed!==priorPagesUsed)fail()
 const onDiagnostic=createGoogleOnlyDiagnosticWriter(c.directory)
 const manager=createManualCartManager({target:GOOGLE_TEST_TARGET,cliSession,expectedBaseline:baseline.state,onDiagnostic,transport})
 const pages=createManualCartPages({directory:c.directory,artifactDirectory:c.artifactDirectory,wranglerPath:c.wranglerPath,...(runPages?{run:runPages}:{})})
 return {c,proof,manager,pages}
}
async function save(directory,name,value){const file=join(directory,name);await writeFile(file+'.tmp',JSON.stringify(value),{mode:0o600});await rename(file+'.tmp',file)}
export async function closeManualCart(configPath,reason={code:'MANUAL_STOP',stage:'worker'},{transport=fetch,runPages}={}){
 const {c,proof,manager,pages}=await context(configPath,{transport,runPages}),failedSteps=[]
 reason=safeGoogleOnlyReason(reason)
 await writeFile(join(c.directory,'stop.request'),'close requested',{mode:0o600})
 // Fixed OFF always precedes waiting for another closer or any session/site work.
 try{await manager.stop()}catch{failedSteps.push('accountOff')}
 try{await writeFile(join(c.directory,'close.claim'),JSON.stringify({pid:process.pid,reason,at:Date.now()}),{flag:'wx',mode:0o600})}catch(e){
  if(e.code!=='EEXIST')throw e
  for(let i=0;i<90;i++){try{return await readGoogleOnlyPrivateJson(join(c.directory,'closed.json'))}catch{/* read only; never issue a second deployment */}await new Promise(r=>setTimeout(r,1000))}
  fail()
 }
 for(const [name,work] of [['cleanup',()=>manager.cleanup(c.startedAt)],['siteClosed',()=>pages.closed(proof)]]){try{await work()}catch{failedSteps.push(name)}}
 try{
  const state=await manager.inspect()
  const [a,w,entry]=await Promise.all([transport(GOOGLE_TEST_TARGET.endpoint+'/account',{headers:{'X-Appwrite-Project':GOOGLE_TEST_TARGET.projectId},redirect:'error',signal:AbortSignal.timeout(5000)}),transport(GOOGLE_TEST_TARGET.origin+'/test-mode.json',{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(5000)}),transport(GOOGLE_TEST_TARGET.origin+'/',{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(5000)})])
  if(state.accountEnabled||Object.values(state.sessions).some(s=>s.length)||a.status!==403||(await a.json()).type!=='general_service_disabled'||!w.ok||(await w.json()).enabled!==false||!entry.ok||/<script\b/i.test(await entry.text()))failedSteps.push('verifyClosed')
 }catch{failedSteps.push('verifyClosed')}
 const result={closed:true,verified:failedSteps.length===0,failedSteps,reason,at:Date.now(),functionUsed:8}
 await save(c.directory,'closed.json',result);return result
}
export async function startManualCartMonitor(configPath){
 await context(configPath)
 const child=spawn(process.execPath,[fileURLToPath(import.meta.url),'--monitor',configPath],{detached:true,stdio:'ignore',env:{PATH:process.env.PATH,HOME:process.env.HOME}});child.unref();return {pid:child.pid}
}
async function monitor(configPath){
 const {c,manager}=await context(configPath);let closing,stop=false
 const close=reason=>{stop=true;closing??=closeManualCart(configPath,reason);return closing}
 process.on('SIGTERM',()=>{void close({code:'SIGNAL_STOP',stage:'worker'})});process.on('SIGINT',()=>{void close({code:'SIGNAL_STOP',stage:'worker'})})
 const awake=process.platform==='darwin'?spawn('/usr/bin/caffeinate',['-w',String(process.pid)],{stdio:'ignore'}):null
 try{
  while(!stop){
   try{await access(join(c.directory,'stop.request'));await close();break}catch(e){if(e.code!=='ENOENT'){await close({code:'STOP_MARKER_READ_FAILED',stage:'worker'});break}}
   try{
    const {state,reason,samples,networkAttempts}=await probeManualCartWithNetworkRecovery({
     probe:()=>probeManualCartState({inspect:manager.inspect,readJournal:()=>readGoogleOnlyPrivateJson(c.journalPath)}),
     onTransient:(reason,attempt)=>save(c.directory,'network-warning.safe.json',{...safeGoogleOnlyReason(reason),attempt,at:Date.now()}),
     shouldStop:async()=>{if(stop)return true;try{await access(join(c.directory,'stop.request'));return true}catch(e){if(e.code==='ENOENT')return false;throw e}},
    })
    if(stop)break
    if(reason){await close(reason);break}
    await save(c.directory,'heartbeat.json',{pid:process.pid,at:Date.now(),manual:true,accountOn:state.accountEnabled,noDeadline:true,samples,networkAttempts})
   }catch(error){await close(googleOnlyErrorReason(error,{code:'PROBE_EXCEPTION',stage:'probe'}));break}
   for(let i=0;i<15&&!stop;i++)await new Promise(r=>setTimeout(r,1000))
  }
 }finally{if(closing)await closing;awake?.kill()}
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
 const [action,path]=process.argv.slice(2)
 if(action==='--monitor')monitor(path).catch(()=>{process.exitCode=1})
 else if(action==='--close')closeManualCart(path).then(r=>{console.log(JSON.stringify(r));if(!r.verified)process.exitCode=1}).catch(()=>{console.error('Manual cart closure UNVERIFIED. Use Console: verygood-au-account-test Account OFF.');process.exitCode=1})
}
