// Manual OFF-only fallback. Never opens Account, enables execution or creates fixtures.
import {readFile,lstat} from 'node:fs/promises'
import {resolve} from 'node:path'
import {pathToFileURL} from 'node:url'
import {createB7LiveWatchdogAdapters} from './customer-account-b7-watchdog-adapters.mjs'
import {createB7Watchdog} from './customer-account-b7-watchdog.mjs'
export async function recoverB7(configPath){
 const s=await lstat(configPath)
 if(!s.isFile()||s.isSymbolicLink()||(s.mode&0o077)!==0||s.uid!==process.getuid())throw Error('B7_PRIVATE_FILE_REQUIRED')
 const config=JSON.parse(await readFile(configPath,'utf8'))
 const adapters=await createB7LiveWatchdogAdapters(config)
 const wd=createB7Watchdog({endsAt:config.endsAt,...adapters})
 return wd.stop()
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
 if(process.argv[2]!=='--test-project-off-only'||!process.argv[3]){console.error('Usage: node scripts/customer-account-b7-recover.mjs --test-project-off-only PRIVATE_CONFIG');process.exitCode=2}
 else recoverB7(process.argv[3]).then(result=>{console.log(JSON.stringify(result));if(!result.verified)process.exitCode=1}).catch(()=>{console.error('B7 recovery unverified; use Console manual Account OFF and Function disabled/execute=[]');process.exitCode=1})
}
