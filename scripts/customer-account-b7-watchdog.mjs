// No implicit credentials or mutations. The runner must supply bounded test-only adapters.
const steps=['accountOff','functionOff','flagsOff','invalidateSigningKey','restoreB6','siteOff','restoreAuthLimit','cleanupRunSessions']
export function createB7Watchdog({endsAt,clock=Date.now,operations,verifyClosed,probe,baselineOom=0,operationTimeoutMs=10000}) {
 if(!Number.isSafeInteger(endsAt)||typeof verifyClosed!=='function'||typeof probe!=='function'||steps.some(s=>typeof operations?.[s]!=='function'))throw Error('B7_WATCHDOG_CONFIGURATION_REJECTED')
 if(!Number.isSafeInteger(operationTimeoutMs)||operationTimeoutMs<1||operationTimeoutMs>15000)throw Error('B7_WATCHDOG_CONFIGURATION_REJECTED')
 async function bounded(operation,timeoutMs=operationTimeoutMs){let timer;try{return await Promise.race([Promise.resolve().then(operation),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('B7_OPERATION_TIMEOUT')),timeoutMs)})])}finally{clearTimeout(timer)}}
 let closing,highLoadSince=null,lastTime=-Infinity
 async function stop(){
  if(closing)return closing
  closing=(async()=>{
   const failedSteps=[]
   for(const step of steps){let ok=false;for(let i=0;i<3;i++){try{await bounded(operations[step],step==='siteOff'?60000:operationTimeoutMs);ok=true;break}catch{/* only idempotent OFF actions; never retry create/deploy */}}if(!ok)failedSteps.push(step)}
   try{if(await bounded(verifyClosed)!==true)failedSteps.push('verifyClosed')}catch{failedSteps.push('verifyClosed')}
   return {closed:true,verified:failedSteps.length===0,failedSteps}
  })()
  return closing
 }
 return {stop,async tick(){
  if(closing)return closing
  const now=clock()
  if(!Number.isFinite(now)||now<lastTime||now>=endsAt)return stop()
  lastTime=now
  try{
   const s=await bounded(probe)
   if(s.load1>=4)highLoadSince??=now;else highLoadSince=null
   if(s.apiHealthy!==true||!Number.isFinite(s.memoryAvailableBytes)||s.memoryAvailableBytes<3*2**30||!Number.isFinite(s.diskAvailableBytes)||s.diskAvailableBytes<30*2**30||!Number.isFinite(s.oomKills)||s.oomKills!==baselineOom||!Number.isFinite(s.load1)||s.budgetReached===true||s.unexpectedExecutions!==0||s.unexpectedUsers!==false||s.metadataChanged!==false||highLoadSince!==null&&now-highLoadSince>=300000)return stop()
   return {closed:false}
  }catch{return stop()}
 }}
}
