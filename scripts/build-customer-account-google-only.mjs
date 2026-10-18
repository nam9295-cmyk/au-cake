import {mkdtemp,mkdir,cp,readFile,writeFile,symlink,lstat} from 'node:fs/promises'
import {join,resolve,dirname} from 'node:path'
import {tmpdir} from 'node:os'
import {spawnSync,spawn} from 'node:child_process'
import {fileURLToPath} from 'node:url'
import {GOOGLE_TEST_TARGET} from './customer-account-google-test.mjs'
import {GOOGLE_ONLY_PLAN_SHA256,assertGoogleOnlyWindow} from '../tools/customer-account-google-only/contract.mjs'
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..')
const closed={enabled:false,startsAt:null,endsAt:null}
export function googleOnlyClosedFiles(){
 const html='<!doctype html><html lang="en"><meta charset="utf-8"><meta name="robots" content="noindex,nofollow"><title>Account test CLOSED</title><body><main><h1>Test CLOSED</h1><p>Customer authentication testing is closed.</p></main></body></html>'
 return {'index.html':html,'account/index.html':html,'account/auth/callback/index.html':html,'404.html':'<!doctype html><title>Not found</title><h1>Not found</h1>','test-window.json':JSON.stringify(closed),'_headers':"/*\n  Cache-Control: no-store\n  Content-Security-Policy: default-src 'none'; script-src 'none'; connect-src 'none'; frame-ancestors 'none'\n  Referrer-Policy: no-referrer\n  X-Robots-Tag: noindex, nofollow\n  X-Content-Type-Options: nosniff\n"}
}
export async function buildGoogleOnlySite({directory}={}){
 const stage=directory?resolve(directory):await mkdtemp(join(tmpdir(),'au-google-only-'))
 await mkdir(stage,{recursive:true})
 const tracked=spawnSync('git',['ls-files','-z'],{cwd:root,encoding:'utf8'})
 if(tracked.status!==0)throw Error('GOOGLE_ONLY_BUILD_REJECTED')
 for(const path of tracked.stdout.split('\0').filter(p=>p.startsWith('src/')||p.startsWith('appwrite-functions/reservation-api/src/')||p==='package.json')){await mkdir(dirname(join(stage,path)),{recursive:true});await cp(join(root,path),join(stage,path))}
 await cp(join(root,'tools/customer-account-google-only'),join(stage,'tools/customer-account-google-only'),{recursive:true})
 const tokens=join(stage,'src/styles/tokens.css')
 await writeFile(tokens,(await readFile(tokens,'utf8')).replace(/@import\s+url\(['"]https:\/\/(?:fonts\.googleapis\.com|cdn\.jsdelivr\.net)\/[^'"]+['"]\);\s*/g,''))
 await symlink(join(root,'node_modules'),join(stage,'node_modules'),'dir')
 const config={VITE_MARKET:'AU',VITE_CUSTOMER_ACCOUNT_ENABLED:'true',VITE_RESERVATION_API_MODE:'all',VITE_RESERVATION_API_FUNCTION_ID:'ca-test-reservation-api',VITE_APPWRITE_ENDPOINT:GOOGLE_TEST_TARGET.endpoint,VITE_APPWRITE_PROJECT_ID:GOOGLE_TEST_TARGET.projectId,VITE_APPWRITE_CAKE_DATABASE_ID:'ca_test_cake_au',VITE_APPWRITE_KIDS_DATABASE_ID:'ca_test_kids_au',VITE_ADMIN_EMAILS:'google-only-disabled@example.invalid',VITE_RESERVATION_NOTIFY_FUNCTION_ID:''}
 const html='<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>VERYGOOD AU Account TEST</title></head><body><div id="root"></div><script type="module" src="/tools/customer-account-google-only/entry.tsx"></script></body></html>'
 await writeFile(join(stage,'index.html'),html)
 await writeFile(join(stage,'build.mjs'),`import {build} from 'vite';import react from '@vitejs/plugin-react';import {writeFile} from 'node:fs/promises';import {resolve} from 'node:path';const result=await build({configFile:false,envDir:false,plugins:[react()],resolve:{alias:[{find:/^(?:.*\\/)?repository(?:\\.ts)?$/,replacement:resolve('tools/customer-account-google-only/orders-unavailable.mjs')}]},define:Object.fromEntries(Object.entries(${JSON.stringify({...config,DEV:false,PROD:true,MODE:'production',BASE_URL:'/'})}).map(([k,v])=>['import.meta.env.'+k,JSON.stringify(v)])),build:{outDir:'dist',target:'esnext'}});await writeFile('inputs.json',JSON.stringify(result.output.filter(x=>x.type==='chunk').flatMap(x=>Object.keys(x.modules))));`)
 const built=spawnSync(process.execPath,['build.mjs'],{cwd:stage,env:{PATH:process.env.PATH||'/usr/bin:/bin',HOME:process.env.HOME||'',TMPDIR:tmpdir()},encoding:'utf8',timeout:120000,maxBuffer:2*1024*1024})
 if(built.status!==0)throw Error('GOOGLE_ONLY_BUILD_FAILED')
 const out=join(stage,'dist'),shell=await readFile(join(out,'index.html'))
 for(const path of ['account','account/auth/callback']){await mkdir(join(out,path),{recursive:true});await writeFile(join(out,path,'index.html'),shell);await writeFile(join(out,path+'.html'),shell)}
 await writeFile(join(out,'404.html'),googleOnlyClosedFiles()['404.html'])
 await writeFile(join(out,'test-window.json'),JSON.stringify(closed))
 await writeFile(join(out,'robots.txt'),'User-agent: *\nDisallow: /\n')
 await writeFile(join(out,'_headers'),"/*\n  Cache-Control: no-store\n  Referrer-Policy: no-referrer\n  X-Robots-Tag: noindex, nofollow\n  X-Content-Type-Options: nosniff\n  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https://api.verygood-chocolate.com; frame-src 'none'; frame-ancestors 'none'; object-src 'none'; base-uri 'self'\n")
 return {stage,directory:out,inputs:JSON.parse(await readFile(join(stage,'inputs.json'),'utf8'))}
}
function deploy(command,args,options){return new Promise((resolve,reject)=>{const child=spawn(command,args,{...options,stdio:'ignore',timeout:60000});child.on('error',()=>reject(Error('GOOGLE_ONLY_DEPLOY_FAILED')));child.on('close',status=>resolve({status}))})}
export function createGoogleOnlyPages({directory,artifactDirectory,wranglerPath,clock=Date.now,run=deploy}){
 if([directory,artifactDirectory,wranglerPath].some(p=>typeof p!=='string'||resolve(p)!==p))throw Error('GOOGLE_ONLY_PAGES_REJECTED')
 function approve(p,ended=false){
  if(p?.kind!=='GOOGLE_ONLY'||p.planSha256!==GOOGLE_ONLY_PLAN_SHA256||p.startAuthorized!==true||p.priorPagesUsed!==7||p.openSlot!==8||p.closedSlot!==9)throw Error('GOOGLE_ONLY_PAGES_REJECTED')
  assertGoogleOnlyWindow(p.window,{now:ended?p.window?.startsAt:clock()})
 }
 async function upload(dir){
  const result=await run(process.execPath,[wranglerPath,'pages','deploy',dir,'--project-name',GOOGLE_TEST_TARGET.pagesProject,'--branch','b3-google-test','--commit-dirty=true'],{cwd:directory,env:{PATH:process.env.PATH||'/usr/bin:/bin',HOME:process.env.HOME||'',CLOUDFLARE_ACCOUNT_ID:GOOGLE_TEST_TARGET.cloudflareAccountId,WRANGLER_SEND_METRICS:'false',CI:'true'}})
  if(result.status!==0)throw Error('GOOGLE_ONLY_DEPLOY_FAILED')
 }
 return {
  async open(proof){
   approve(proof)
   await writeFile(join(directory,'pages-8.claim'),proof.window.runId,{flag:'wx',mode:0o600})
   await writeFile(join(artifactDirectory,'test-window.json'),JSON.stringify(proof.window))
   await upload(artifactDirectory)
   return {pagesUsed:8,openAttempted:true}
  },
  async closed(proof){
   approve(proof,true)
   const claimed=await lstat(join(directory,'pages-8.claim'))
   if(!claimed.isFile()||claimed.isSymbolicLink())throw Error('GOOGLE_ONLY_PAGES_REJECTED')
   let claim='created'
   try{await writeFile(join(directory,'pages-9.claim'),proof.window.runId,{flag:'wx',mode:0o600})}catch(error){claim=error.code==='EEXIST'?'exists':'failed'}
   if(claim==='failed')throw Error('GOOGLE_ONLY_PAGES_REJECTED')
   if(claim==='exists'){
    // Another OFF process may already be restoring. Never spend a third slot.
    for(let i=0;i<60;i++){try{const done=JSON.parse(await readFile(join(directory,'pages-9.safe.json'),'utf8'));if(done.pagesUsed===9&&done.runId===proof.window.runId)return {pagesUsed:9,closed:true}}catch{/* bounded read-only wait */}await new Promise(resolve=>setTimeout(resolve,1000))}
    throw Error('GOOGLE_ONLY_CLOSED_UNVERIFIED')
   }
   const dir=join(directory,'closed-site');await mkdir(dir,{recursive:true,mode:0o700})
   for(const [file,body] of Object.entries(googleOnlyClosedFiles())){await mkdir(dirname(join(dir,file)),{recursive:true});await writeFile(join(dir,file),body)}
   await upload(dir)
   await writeFile(join(directory,'pages-9.safe.json'),JSON.stringify({pagesUsed:9,runId:proof.window.runId}),{flag:'wx',mode:0o600})
   return {pagesUsed:9,closed:true}
  },
 }
}
