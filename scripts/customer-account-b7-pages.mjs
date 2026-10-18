import {mkdir,writeFile,readFile,readdir} from 'node:fs/promises'
import {join,isAbsolute} from 'node:path'
import {spawn} from 'node:child_process'
function execute(command,args,options){return new Promise((resolve,reject)=>{const child=spawn(command,args,{...options,stdio:'ignore'});child.once('error',()=>reject(Error('B7_CLOSED_SITE_DEPLOY_FAILED')));child.once('close',status=>resolve({status}))})}
// Stop operation only. No production project, open-window artifact or arbitrary upload.
export function createB7ClosedSiteAdapter({directory,pagesAttemptSlotsUsed,wranglerPath,run=execute,budgetApprovalProof}) {
 const expanded=budgetApprovalProof?.approved===true&&budgetApprovalProof.manifestSha256==='1c4245230e8bd89e72548bc0573ca158247462e93a8b427cdaa175d84b4d7c90'&&budgetApprovalProof.previousUsed===2&&budgetApprovalProof.additionalMax===3&&budgetApprovalProof.cumulativeMax===5
 if(budgetApprovalProof!==undefined&&!expanded)throw Error('B7_PAGES_CONFIGURATION_REJECTED')
 if(!isAbsolute(directory||'')||!isAbsolute(wranglerPath||'')||!Number.isInteger(pagesAttemptSlotsUsed)||pagesAttemptSlotsUsed<0||pagesAttemptSlotsUsed>=(expanded?5:3))throw Error('B7_PAGES_CONFIGURATION_REJECTED')
 let attempted=false
 return async()=>{
  if(attempted)throw Error('B7_PAGES_ALREADY_ATTEMPTED')
  attempted=true
  await writeFile(join(directory,'closed-site-deploy.claim'),String(pagesAttemptSlotsUsed+1),{flag:'wx',mode:0o600})
  const site=join(directory,'closed-site');await mkdir(site,{mode:0o700})
  await writeFile(join(site,'index.html'),'<!doctype html><html lang="en"><meta charset="utf-8"><meta name="robots" content="noindex,nofollow"><title>VERYGOOD AU Account TEST — CLOSED</title><body><h1>Test closed</h1><p>Customer authentication testing is closed.</p></body></html>')
  await writeFile(join(site,'test-window.json'),JSON.stringify({enabled:false,startsAt:null,endsAt:null}))
  await writeFile(join(site,'_headers'),"/*\n  Content-Security-Policy: default-src 'self'; script-src 'none'; connect-src 'none'; frame-src 'none'; object-src 'none'\n  X-Robots-Tag: noindex, nofollow\n/test-window.json\n  Cache-Control: no-store\n")
  if((await readdir(site)).length!==3||JSON.parse(await readFile(join(site,'test-window.json'),'utf8')).enabled!==false)throw Error('B7_CLOSED_SITE_INVALID')
  const result=await run(process.execPath,[wranglerPath,'pages','deploy',site,'--project-name','au-cake-account-test','--branch','b3-google-test','--commit-dirty=true'],{cwd:directory,timeout:60000,env:{PATH:process.env.PATH||'/usr/bin:/bin',HOME:process.env.HOME||'',CLOUDFLARE_ACCOUNT_ID:'f10bef6fa6f6abc7982d3792e250a9bc',WRANGLER_SEND_METRICS:'false',CI:'true'}})
  if(result.status!==0)throw Error('B7_CLOSED_SITE_DEPLOY_FAILED')
  return {attempts:pagesAttemptSlotsUsed+1,entryEnabled:false}
 }
}
