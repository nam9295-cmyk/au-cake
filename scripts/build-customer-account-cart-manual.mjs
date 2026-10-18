import {readFile,writeFile,mkdir,cp,lstat} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {spawnSync,spawn} from 'node:child_process'
import {buildGoogleOnlySite,googleOnlyClosedFiles} from './build-customer-account-google-only.mjs'
import {assertManualCartMode} from '../tools/customer-account-cart-manual/contract.mjs'
import {GOOGLE_TEST_TARGET} from './customer-account-google-test.mjs'
export const MANUAL_CART_ROUTES=['account','account/auth/callback','cart','cakes','chocolates','cakes/pave-chocolate-cake','chocolates/pave-chocolate']
const closed={enabled:false,mode:'manual-cart'}
const closureUnverified=()=>{throw Error('MANUAL_CART_CLOSED_UNVERIFIED')}
export function assertManualCartBudget(p){
 if(p?.kind!=='MANUAL_CART'||p.startAuthorized!==true||![9,11].includes(p.priorPagesUsed)||p.openSlot!==p.priorPagesUsed+1||p.closedSlot!==p.priorPagesUsed+2)throw Error('MANUAL_CART_APPROVAL_REQUIRED')
 return {priorPagesUsed:p.priorPagesUsed,openSlot:p.openSlot,closedSlot:p.closedSlot}
}
export async function buildManualCartSite({directory}){
 const a=await buildGoogleOnlySite({directory}),root=resolve('.')
 await cp(join(root,'tools/customer-account-cart-manual'),join(a.stage,'tools/customer-account-cart-manual'),{recursive:true})
 await mkdir(join(a.stage,'public'),{recursive:true})
 await cp(join(root,'public/products'),join(a.stage,'public/products'),{recursive:true})
 const html=(await readFile(join(a.stage,'index.html'),'utf8')).replace('/tools/customer-account-google-only/entry.tsx','/tools/customer-account-cart-manual/entry.tsx')
 await writeFile(join(a.stage,'index.html'),html)
 const script=(await readFile(join(a.stage,'build.mjs'),'utf8')).replace('resolve:{alias:[',"resolve:{alias:[{find:/^(?:.*\\/)?renewal-client(?:\\.ts)?$/,replacement:resolve('tools/customer-account-cart-manual/orders-blocked.mjs')},")
 await writeFile(join(a.stage,'build.mjs'),script)
 const result=spawnSync(process.execPath,['build.mjs'],{cwd:a.stage,env:{PATH:process.env.PATH,HOME:process.env.HOME},stdio:'ignore',timeout:120000})
 if(result.status!==0)throw Error('MANUAL_CART_BUILD_FAILED')
 const shell=await readFile(join(a.directory,'index.html'))
 for(const route of MANUAL_CART_ROUTES){await mkdir(join(a.directory,route),{recursive:true});await writeFile(join(a.directory,route,'index.html'),shell);await writeFile(join(a.directory,route+'.html'),shell)}
 await writeFile(join(a.directory,'test-mode.json'),JSON.stringify(closed))
 await writeFile(join(a.directory,'test-window.json'),JSON.stringify({enabled:false,startsAt:null,endsAt:null}))
 await writeFile(join(a.directory,'404.html'),googleOnlyClosedFiles()['404.html'])
 await writeFile(join(a.directory,'_headers'),"/*\n  Cache-Control: no-store\n  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https://api.verygood-chocolate.com; form-action 'none'; frame-src 'none'; frame-ancestors 'none'; object-src 'none'; base-uri 'self'\n  Referrer-Policy: no-referrer\n  X-Robots-Tag: noindex, nofollow\n  X-Content-Type-Options: nosniff\n")
 return {...a,inputs:JSON.parse(await readFile(join(a.stage,'inputs.json'),'utf8'))}
}
function upload(dir,wranglerPath,cwd){return new Promise((resolve,reject)=>{
 const child=spawn(process.execPath,[wranglerPath,'pages','deploy',dir,'--project-name',GOOGLE_TEST_TARGET.pagesProject,'--branch','b3-google-test','--commit-dirty=true'],{cwd,env:{PATH:process.env.PATH,HOME:process.env.HOME,CLOUDFLARE_ACCOUNT_ID:GOOGLE_TEST_TARGET.cloudflareAccountId,WRANGLER_SEND_METRICS:'false',CI:'true'},stdio:'ignore',timeout:60000})
 child.on('error',()=>reject(Error('MANUAL_CART_DEPLOY_FAILED')));child.on('close',status=>status===0?resolve():reject(Error('MANUAL_CART_DEPLOY_FAILED')))
})}
export function createManualCartPages({directory,artifactDirectory,wranglerPath,run=upload}){
 if([directory,artifactDirectory,wranglerPath].some(p=>resolve(p)!==p))throw Error('MANUAL_CART_TARGET_REJECTED')
 const approve=(p,closing=false)=>{const budget=assertManualCartBudget(p);assertManualCartMode({enabled:true,mode:'manual-cart',runId:p.runId,startedAt:p.startedAt},closing?{now:p.startedAt}:{});return budget}
 return {
  async open(proof){const {openSlot}=approve(proof);await writeFile(join(directory,`pages-${openSlot}.claim`),proof.runId,{flag:'wx',mode:0o600});await writeFile(join(artifactDirectory,'test-mode.json'),JSON.stringify({enabled:true,mode:'manual-cart',runId:proof.runId,startedAt:proof.startedAt}));await run(artifactDirectory,wranglerPath,directory);return {pagesUsed:openSlot}},
  async closed(proof){
   const {priorPagesUsed,openSlot,closedSlot}=approve(proof,true)
   try{await lstat(join(directory,`pages-${openSlot}.claim`))}catch(e){if(e.code==='ENOENT')return {pagesUsed:priorPagesUsed,notOpened:true};throw e}
   try{await writeFile(join(directory,`pages-${closedSlot}.claim`),proof.runId,{flag:'wx',mode:0o600})}catch(e){if(e.code!=='EEXIST')throw e;for(let i=0;i<60;i++){try{const receipt=JSON.parse(await readFile(join(directory,`pages-${closedSlot}.safe.json`),'utf8'));if(receipt.runId===proof.runId)return receipt}catch{/* read only */}await new Promise(r=>setTimeout(r,1000))}closureUnverified()}
   const out=join(directory,'closed-site'),files={...googleOnlyClosedFiles(),'test-mode.json':JSON.stringify(closed)}
   for(const route of MANUAL_CART_ROUTES){files[route+'/index.html']=files['index.html'];files[route+'.html']=files['index.html']}
   for(const [path,value] of Object.entries(files)){await mkdir(join(out,path,'..'),{recursive:true});await writeFile(join(out,path),value)}
   await run(out,wranglerPath,directory)
   const receipt={runId:proof.runId,pagesUsed:closedSlot,closed:true};await writeFile(join(directory,`pages-${closedSlot}.safe.json`),JSON.stringify(receipt),{flag:'wx',mode:0o600});return receipt
  },
 }
}
