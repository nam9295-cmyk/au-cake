import {readFileSync,lstatSync,writeFileSync} from 'node:fs'
import {writeFile,rename,access} from 'node:fs/promises'
import {spawn} from 'node:child_process'
import {fileURLToPath,pathToFileURL} from 'node:url'
import {join,resolve} from 'node:path'
import {createB7Watchdog} from './customer-account-b7-watchdog.mjs'
const file=fileURLToPath(import.meta.url),steps=['accountOff','functionOff','flagsOff','invalidateSigningKey','restoreB6','siteOff','restoreAuthLimit','cleanupRunSessions']
function configAt(path){
 const info=lstatSync(path)
 if(!info.isFile()||info.isSymbolicLink()||(info.mode&0o077)!==0||info.uid!==process.getuid())throw Error('B7_PRIVATE_FILE_REQUIRED')
 const config=JSON.parse(readFileSync(path,'utf8'))
 if(config.mode==='controlled-run'&&config.manifestSha256!=='1c4245230e8bd89e72548bc0573ca158247462e93a8b427cdaa175d84b4d7c90')throw Error('B7_V3_PROCESS_BINDING_REJECTED')
 if(!['self-test','controlled-run'].includes(config.mode)||!Number.isSafeInteger(config.endsAt)||!config.directory||!resolve(config.directory).startsWith('/'))throw Error('B7_PROCESS_CONFIGURATION_REJECTED')
 return config
}
export function startB7WatchdogProcess({configPath}) {
 configAt(configPath)
 const child=spawn(process.execPath,[file,'--worker',resolve(configPath)],{detached:true,stdio:'ignore',env:{PATH:process.env.PATH||'/usr/bin:/bin',HOME:process.env.HOME||''}})
 child.unref();return {pid:child.pid}
}
export function createB7ActivationLease({configPath,clock=Date.now}){
 return async()=>{
  try{
   const c=configAt(configPath)
   if(c.mode!=='controlled-run'||c.liveExecutionAuthorized!==true||clock()>=c.endsAt)return false
   for(const name of ['stop.request','closed.json','worker-failed.json']){try{await access(join(c.directory,name));return false}catch{/* no stop evidence */}}
   const heartbeat=JSON.parse(readFileSync(join(c.directory,'heartbeat.json'),'utf8'))
   if(!Number.isFinite(Date.parse(heartbeat.at))||heartbeat.mode!=='controlled-run'||heartbeat.closed!==false||heartbeat.endsAt!==c.endsAt||!Number.isInteger(heartbeat.pid)||clock()-Date.parse(heartbeat.at)>5000||Date.parse(heartbeat.at)>clock()+1000)return false
   process.kill(heartbeat.pid,0);return true
  }catch{return false}
 }
}
export async function requestB7Stop({configPath}) {const c=configAt(configPath);await writeFile(join(c.directory,'stop.request'),'stop\n',{mode:0o600,flag:'wx'})}
export async function runB7WatchdogWorker(configPath){
 process.umask(0o077);const config=configAt(configPath),operationsRun=[]
 let adapter
 if(config.mode==='self-test')adapter={operations:Object.fromEntries(steps.map(s=>[s,async()=>{operationsRun.push(s)}])),probe:async()=>({apiHealthy:true,memoryAvailableBytes:8*2**30,diskAvailableBytes:80*2**30,load1:0,oomKills:0,unexpectedExecutions:0,unexpectedUsers:false,metadataChanged:false}),verifyClosed:async()=>true}
 else {
  if(config.liveExecutionAuthorized!==true)throw Error('B7_LIVE_PROCESS_NOT_AUTHORIZED')
  const {createB7LiveWatchdogAdapters}=await import('./customer-account-b7-v3-watchdog-adapters.mjs')
  adapter=await createB7LiveWatchdogAdapters(config)
 }
 const off=adapter.operations.accountOff
 adapter.operations.accountOff=async()=>{try{await writeFile(join(config.directory,'stop.request'),'stop\n',{mode:0o600,flag:'wx'})}catch(e){if(e.code!=='EEXIST')throw e}return off()}
 const wd=createB7Watchdog({endsAt:config.endsAt,baselineOom:config.baselineOom||0,...adapter})
 let stop=false;process.on('SIGTERM',()=>{stop=true});process.on('SIGINT',()=>{stop=true})
 let sleepGuard
 if(process.platform==='darwin'&&config.mode==='controlled-run'){sleepGuard=spawn('/usr/bin/caffeinate',['-w',String(process.pid)],{stdio:'ignore'});sleepGuard.on('error',()=>{stop=true})}
 try{
  while(true){
   try{await access(join(config.directory,'stop.request'));stop=true}catch{/* no manual stop yet */}
   const result=stop?await wd.stop():await wd.tick()
   const evidence={...result,mode:config.mode,operations:operationsRun,pid:process.pid,at:new Date().toISOString(),endsAt:config.endsAt}
   const path=join(config.directory,result.closed?'closed.json':'heartbeat.json')
   await writeFile(path+'.tmp',JSON.stringify(evidence),{mode:0o600});await rename(path+'.tmp',path)
   if(result.closed)return result
   await new Promise(r=>setTimeout(r,config.mode==='self-test'?Math.min(config.intervalMs||20,100):1000))
  }
 }finally{sleepGuard?.kill()}
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url&&process.argv[2]==='--worker'){
 runB7WatchdogWorker(process.argv[3]).catch(()=>{try{const c=configAt(process.argv[3]);writeFileSync(join(c.directory,'worker-failed.json'),JSON.stringify({verified:false,manualRecoveryRequired:true}),{mode:0o600})}catch{/* no secret or credential errors printed */}process.exitCode=1})
}
