import {readFile,lstat,writeFile,rename,access} from 'node:fs/promises'
import {spawn} from 'node:child_process'
import {fileURLToPath,pathToFileURL} from 'node:url'
import {resolve,join} from 'node:path'
import {assertGoogleOnlyWindow,GOOGLE_ONLY_PLAN_SHA256} from '../tools/customer-account-google-only/contract.mjs'
const fail=()=>{throw Error('GOOGLE_ONLY_WATCHDOG_REJECTED')}
async function bounded(work,ms=4500){let timer;try{return await Promise.race([Promise.resolve().then(work),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('GOOGLE_ONLY_TIMEOUT')),ms)})])}finally{clearTimeout(timer)}}
export function createGoogleOnlyWatchdog({window,clock=Date.now,probe,off,cleanup,siteOff,verify,baselineOom=0}){
 assertGoogleOnlyWindow(window,{now:window?.startsAt})
 if([probe,off,cleanup,siteOff,verify].some(x=>typeof x!=='function'))fail()
 let closing,lastTime=-Infinity,highSince=null
 async function stop(){
  if(closing)return closing
  closing=(async()=>{
   const failedSteps=[]
   for(const [name,operation] of [['accountOff',off],['cleanup',cleanup],['siteClosed',siteOff]]){try{await bounded(operation,name==='siteClosed'?65000:10000)}catch{failedSteps.push(name)}}
   try{if(await bounded(verify,10000)!==true)failedSteps.push('verifyClosed')}catch{failedSteps.push('verifyClosed')}
   return {closed:true,verified:failedSteps.length===0,failedSteps}
  })();return closing
 }
 return {stop,async tick(){
  if(closing)return closing
  const at=clock();if(!Number.isFinite(at)||at<lastTime||at<window.startsAt||at>=window.endsAt)return stop();lastTime=at
  try{
   const sample=await bounded(probe)
   if(sample.load1>=4)highSince??=at;else highSince=null
   if(clock()>=window.endsAt||sample.safe!==true||!Number.isFinite(sample.memoryAvailableBytes)||sample.memoryAvailableBytes<3*2**30||!Number.isFinite(sample.diskAvailableBytes)||sample.diskAvailableBytes<30*2**30||!Number.isFinite(sample.oomKills)||sample.oomKills!==baselineOom||!Number.isFinite(sample.load1)||highSince!==null&&at-highSince>=300000)return stop()
   return {closed:false,verified:false,checkedAt:clock()}
  }catch{return stop()}
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
export async function inspectGoogleOnlyLease({configPath,clock=Date.now}){
 try{
  const c=await configAt(configPath);if(c.mode!=='live'||c.startAuthorized!==true)return false
  assertGoogleOnlyWindow(c.window,{now:clock()})
  for(const file of ['stop.request','closed.json','worker-failed.json']){try{await access(join(c.directory,file));return false}catch(e){if(e.code!=='ENOENT')return false}}
  const h=JSON.parse(await readFile(join(c.directory,'heartbeat.json'),'utf8')),age=clock()-h.at
  const probeAge=clock()-h.checkedAt
  if(h.closed!==false||h.startsAt!==c.window.startsAt||h.endsAt!==c.window.endsAt||h.runId!==c.window.runId||!Number.isSafeInteger(h.pid)||h.pid<1||!Number.isFinite(age)||age<0||age>5000||!Number.isFinite(probeAge)||probeAge<0||probeAge>5000)return false
  process.kill(h.pid,0);return true
 }catch{return false}
}
export async function runGoogleOnlyWatchdog(configPath){
 process.umask(0o077);const c=await configAt(configPath)
 let adapter
 if(c.mode==='self-test')adapter={probe:async()=>({safe:true,memoryAvailableBytes:8*2**30,diskAvailableBytes:80*2**30,load1:0,oomKills:0}),off:async()=>{},cleanup:async()=>{},siteOff:async()=>{},verify:async()=>true}
 else adapter=await (await import(pathToFileURL(c.adapterPath).href)).createGoogleOnlyLiveAdapters(c)
 const wd=createGoogleOnlyWatchdog({window:c.window,...adapter,baselineOom:c.baselineOom||0})
 const save=async(name,value)=>{const p=join(c.directory,name);await writeFile(p+'.tmp',JSON.stringify(value),{mode:0o600});await rename(p+'.tmp',p)}
 let closed=false,checkedAt=0,inFlight=false,stopReason=false,closing
 const stop=()=>{if(closing)return closing;closed=true;closing=(async()=>{const result=await wd.stop();await save('closed.json',{...result,at:Date.now(),endsAt:c.window.endsAt});return result})();return closing}
 process.on('SIGTERM',()=>{void stop()});process.on('SIGINT',()=>{void stop()})
 const deadline=setTimeout(()=>{void stop()},Math.max(0,c.window.endsAt-Date.now()))
 let sleepGuard
 if(c.mode==='live'&&process.platform==='darwin')sleepGuard=spawn('/usr/bin/caffeinate',['-w',String(process.pid)],{stdio:'ignore'})
 try{
  while(!closed){
   try{await access(join(c.directory,'stop.request'));stopReason=true}catch(e){if(e.code!=='ENOENT')stopReason=true}
   if(stopReason||checkedAt&&Date.now()-checkedAt>5000){await stop();break}
   if(!inFlight){inFlight=true;void wd.tick().then(async s=>{if(s.closed){await stop()}else checkedAt=s.checkedAt}).catch(()=>stop()).finally(()=>{inFlight=false})}
   if(checkedAt)await save('heartbeat.json',{closed:false,pid:process.pid,at:Date.now(),checkedAt,startsAt:c.window.startsAt,endsAt:c.window.endsAt,runId:c.window.runId})
   await new Promise(r=>setTimeout(r,1000))
  }
 }catch{await stop()}finally{await closing;clearTimeout(deadline);sleepGuard?.kill()}
}
export async function recoverGoogleOnly(configPath){
 const c=await configAt(configPath)
 if(c.mode!=='live'||c.startAuthorized!==true)fail()
 const adapter=await (await import(pathToFileURL(c.adapterPath).href)).createGoogleOnlyLiveAdapters(c)
 return createGoogleOnlyWatchdog({window:c.window,...adapter,baselineOom:c.baselineOom||0}).stop()
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url&&process.argv[2]==='--worker'){
 runGoogleOnlyWatchdog(process.argv[3]).catch(async()=>{try{const c=await configAt(process.argv[3]);await writeFile(join(c.directory,'worker-failed.json'),JSON.stringify({verified:false,manualRecoveryRequired:true}),{mode:0o600})}catch{/* never print credentials or raw errors */}process.exitCode=1})
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url&&process.argv[2]==='--recover'){
 recoverGoogleOnly(process.argv[3]).then(result=>{console.log(JSON.stringify(result));if(!result.verified)process.exitCode=1}).catch(()=>{console.error('Google-only recovery UNVERIFIED; use Console test Account OFF');process.exitCode=1})
}
