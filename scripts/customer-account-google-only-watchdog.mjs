import {readFile,lstat,writeFile,rename,access} from 'node:fs/promises'
import {spawn} from 'node:child_process'
import {fileURLToPath,pathToFileURL} from 'node:url'
import {resolve,join} from 'node:path'
import {openSync,closeSync,fstatSync,writeSync,constants} from 'node:fs'
import {assertGoogleOnlyWindow,GOOGLE_ONLY_PLAN_SHA256} from '../tools/customer-account-google-only/contract.mjs'
import {createGoogleOnlyDiagnostics,safeGoogleOnlyReason,googleOnlyDiagnosticError,googleOnlyErrorReason} from './customer-account-google-only-diagnostics.mjs'
const fail=()=>{throw Error('GOOGLE_ONLY_WATCHDOG_REJECTED')}
async function bounded(work,ms=4500,stage='probe',code='PROBE_TIMEOUT'){let timer;try{return await Promise.race([Promise.resolve().then(work),new Promise((_,reject)=>{timer=setTimeout(()=>reject(googleOnlyDiagnosticError(code,stage,{limitMs:ms})),ms)})])}finally{clearTimeout(timer)}}
export function createGoogleOnlyWatchdog({window,clock=Date.now,probe,off,cleanup,siteOff,verify,baselineOom=0,onDiagnostic}){
 assertGoogleOnlyWindow(window,{now:window?.startsAt})
 if([probe,off,cleanup,siteOff,verify].some(x=>typeof x!=='function'))fail()
 const diagnostics=createGoogleOnlyDiagnostics({clock,onDiagnostic})
 let closing,lastTime=-Infinity,highSince=null
 async function stop(input={code:'MANUAL_STOP',stage:'worker'}){
  if(closing)return closing
  const reason=Object.freeze(safeGoogleOnlyReason(input))
  closing=(async()=>{
   diagnostics.record({...reason,phase:'stop'})
   const failedSteps=[]
   async function restore(name,operation,ms){
    const start=clock();diagnostics.record({stage:name,code:'OK',phase:'start'})
    try{
     if(await bounded(operation,ms,name,'STEP_FAILED')===false)throw googleOnlyDiagnosticError('STEP_FAILED',name)
     diagnostics.record({stage:name,code:'OK',phase:'pass',durationMs:Math.max(0,clock()-start)})
    }catch(error){failedSteps.push(name);diagnostics.record({...googleOnlyErrorReason(error,{code:'STEP_FAILED',stage:name}),phase:'fail',durationMs:Math.max(0,clock()-start)})}
   }
   // Logging failure never prevents the fixed OFF request or later recovery steps.
   for(const [name,operation] of [['accountOff',off],['cleanup',cleanup],['siteClosed',siteOff]])await restore(name,operation,name==='siteClosed'?65000:10000)
   await restore('verifyClosed',async()=>await verify()===true,10000)
   if(!diagnostics.healthy())failedSteps.push('diagnostics')
   return {closed:true,verified:failedSteps.length===0,failedSteps,reason}
  })();return closing
 }
 return {stop,async tick(){
  if(closing)return closing
  const at=clock()
  if(!Number.isFinite(at)||at<lastTime)return stop({code:'CLOCK_INVALID',stage:'worker'})
  if(at<window.startsAt)return stop({code:'WINDOW_NOT_STARTED',stage:'worker'})
  if(at>=window.endsAt)return stop({code:'DEADLINE',stage:'worker'})
  lastTime=at
  try{
   const sample=await diagnostics.measure('probe',()=>bounded(probe),'PROBE_EXCEPTION')
   if(sample.load1>=4)highSince??=at;else highSince=null
   if(clock()>=window.endsAt)return stop({code:'DEADLINE',stage:'worker'})
   if(sample.safe!==true)return stop(sample.reason||{code:'PROBE_UNSAFE',stage:'probe'})
   if(!Number.isFinite(sample.memoryAvailableBytes)||sample.memoryAvailableBytes<3*2**30)return stop({code:'RESOURCE_MEMORY',stage:'resource'})
   if(!Number.isFinite(sample.diskAvailableBytes)||sample.diskAvailableBytes<30*2**30)return stop({code:'RESOURCE_DISK',stage:'resource'})
   if(!Number.isFinite(sample.oomKills)||sample.oomKills!==baselineOom)return stop({code:'RESOURCE_OOM',stage:'resource'})
   if(!Number.isFinite(sample.load1)||highSince!==null&&at-highSince>=300000)return stop({code:'RESOURCE_LOAD',stage:'resource'})
   return {closed:false,verified:false,checkedAt:clock()}
  }catch(error){return stop(googleOnlyErrorReason(error,{code:'PROBE_EXCEPTION',stage:'probe'}))}
 }}
}
async function configAt(path){
 const info=await lstat(path)
 if(!info.isFile()||info.isSymbolicLink()||(info.mode&0o077)!==0||info.uid!==process.getuid())fail()
 const c=JSON.parse(await readFile(path,'utf8'))
 if(c.kind!=='GOOGLE_ONLY'||c.planSha256!==GOOGLE_ONLY_PLAN_SHA256||!['self-test','live'].includes(c.mode)||!c.directory||resolve(c.directory)!==c.directory)fail()
 if(c.mode==='live'&&(c.startAuthorized!==true||!c.adapterPath||!c.window))fail()
 return c
}
export async function startGoogleOnlyWatchdog({configPath}){
 const c=await configAt(configPath)
 if(c.mode==='live')assertGoogleOnlyWindow(c.window)
 const child=spawn(process.execPath,[fileURLToPath(import.meta.url),'--worker',resolve(configPath)],{detached:true,stdio:'ignore',env:{PATH:process.env.PATH||'/usr/bin:/bin',HOME:process.env.HOME||''}})
 child.unref();return {pid:child.pid}
}
export async function inspectGoogleOnlyLeaseDetailed({configPath,clock=Date.now}){
 const result=(code,extra={})=>({ok:code==='LEASE_FRESH',...safeGoogleOnlyReason({code,stage:'lease',...extra})})
 try{
  const c=await configAt(configPath);if(c.mode!=='live'||c.startAuthorized!==true)return result('LEASE_CONFIG_INVALID')
  try{assertGoogleOnlyWindow(c.window,{now:clock()})}catch{return result('LEASE_WINDOW_INVALID')}
  for(const file of ['stop.request','closed.json','worker-failed.json']){try{await access(join(c.directory,file));return result('LEASE_STOPPED')}catch(e){if(e.code!=='ENOENT')return result('LEASE_CONFIG_INVALID')}}
  const h=JSON.parse(await readFile(join(c.directory,'heartbeat.json'),'utf8')),age=clock()-h.at
  const probeAge=clock()-h.checkedAt
  if(h.closed!==false||h.startsAt!==c.window.startsAt||h.endsAt!==c.window.endsAt||h.runId!==c.window.runId||!Number.isSafeInteger(h.pid)||h.pid<1)return result('LEASE_HEARTBEAT_INVALID')
  const ages={heartbeatAgeMs:age,probeAgeMs:probeAge,limitMs:5000}
  if(!Number.isFinite(age)||age<0||!Number.isFinite(probeAge)||probeAge<0)return result('LEASE_CLOCK_INVALID',ages)
  if(age>5000)return result('LEASE_HEARTBEAT_STALE',ages)
  if(probeAge>5000)return result('LEASE_PROBE_STALE',ages)
  try{process.kill(h.pid,0)}catch{return result('LEASE_WORKER_DEAD',ages)}
  return result('LEASE_FRESH',ages)
 }catch{return result('LEASE_CONFIG_INVALID')}
}
export async function inspectGoogleOnlyLease(options){return (await inspectGoogleOnlyLeaseDetailed(options)).ok}
function diagnosticWriter(directory){return event=>{
 const fd=openSync(join(directory,'diagnostics.jsonl'),constants.O_WRONLY|constants.O_CREAT|constants.O_APPEND|constants.O_NOFOLLOW,0o600)
 try{
  const info=fstatSync(fd)
  if(!info.isFile()||(info.mode&0o077)!==0||info.uid!==process.getuid())fail()
  writeSync(fd,JSON.stringify(event)+'\n')
 }finally{closeSync(fd)}
}}
export async function runGoogleOnlyWatchdog(configPath){
 process.umask(0o077);const c=await configAt(configPath)
 const onDiagnostic=diagnosticWriter(c.directory)
 let adapter
 if(c.mode==='self-test')adapter={probe:async()=>({safe:true,memoryAvailableBytes:8*2**30,diskAvailableBytes:80*2**30,load1:0,oomKills:0}),off:async()=>{},cleanup:async()=>{},siteOff:async()=>{},verify:async()=>true}
 else adapter=await (await import(pathToFileURL(c.adapterPath).href)).createGoogleOnlyLiveAdapters(c,{onDiagnostic})
 const wd=createGoogleOnlyWatchdog({window:c.window,...adapter,baselineOom:c.baselineOom||0,onDiagnostic})
 const save=async(name,value)=>{const p=join(c.directory,name);await writeFile(p+'.tmp',JSON.stringify(value),{mode:0o600});await rename(p+'.tmp',p)}
 let closed=false,checkedAt=0,inFlight=false,stopReason,closing
 const stop=reason=>{if(closing)return closing;closed=true;closing=(async()=>{const result=await wd.stop(reason);await save('closed.json',{...result,at:Date.now(),endsAt:c.window.endsAt});return result})();return closing}
 process.on('SIGTERM',()=>{void stop({code:'SIGNAL_STOP',stage:'worker'})});process.on('SIGINT',()=>{void stop({code:'SIGNAL_STOP',stage:'worker'})})
 const deadline=setTimeout(()=>{void stop({code:'DEADLINE',stage:'worker'})},Math.max(0,c.window.endsAt-Date.now()))
 let sleepGuard
 if(c.mode==='live'&&process.platform==='darwin')sleepGuard=spawn('/usr/bin/caffeinate',['-w',String(process.pid)],{stdio:'ignore'})
 try{
  while(!closed){
   try{await access(join(c.directory,'stop.request'));stopReason={code:'STOP_MARKER',stage:'worker'}}catch(e){if(e.code!=='ENOENT')stopReason={code:'STOP_MARKER_READ_FAILED',stage:'worker'}}
   if(stopReason||checkedAt&&Date.now()-checkedAt>5000){await stop(stopReason||{code:'LEASE_PROBE_STALE',stage:'lease',probeAgeMs:Date.now()-checkedAt,limitMs:5000});break}
   if(!inFlight){inFlight=true;void wd.tick().then(async s=>{if(s.closed){await stop(s.reason)}else checkedAt=s.checkedAt}).catch(()=>stop({code:'WORKER_EXCEPTION',stage:'worker'})).finally(()=>{inFlight=false})}
   if(checkedAt)await save('heartbeat.json',{closed:false,pid:process.pid,at:Date.now(),checkedAt,startsAt:c.window.startsAt,endsAt:c.window.endsAt,runId:c.window.runId})
   await new Promise(r=>setTimeout(r,1000))
  }
 }catch{await stop({code:'WORKER_EXCEPTION',stage:'worker'})}finally{await closing;clearTimeout(deadline);sleepGuard?.kill()}
}
export async function recoverGoogleOnly(configPath){
 const c=await configAt(configPath)
 if(c.mode!=='live'||c.startAuthorized!==true)fail()
 const onDiagnostic=diagnosticWriter(c.directory)
 const adapter=await (await import(pathToFileURL(c.adapterPath).href)).createGoogleOnlyLiveAdapters(c,{onDiagnostic})
 return createGoogleOnlyWatchdog({window:c.window,...adapter,baselineOom:c.baselineOom||0,onDiagnostic}).stop()
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url&&process.argv[2]==='--worker'){
 runGoogleOnlyWatchdog(process.argv[3]).catch(async()=>{try{const c=await configAt(process.argv[3]);await writeFile(join(c.directory,'worker-failed.json'),JSON.stringify({verified:false,manualRecoveryRequired:true}),{mode:0o600})}catch{/* never print credentials or raw errors */}process.exitCode=1})
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url&&process.argv[2]==='--recover'){
 recoverGoogleOnly(process.argv[3]).then(result=>{console.log(JSON.stringify(result));if(!result.verified)process.exitCode=1}).catch(()=>{console.error('Google-only recovery UNVERIFIED; use Console test Account OFF');process.exitCode=1})
}
