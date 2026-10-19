import {mkdtemp,readFile,writeFile,mkdir,cp,symlink} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {resolve,join,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import {spawnSync} from 'node:child_process'
import {sha256,B7_MANIFEST_SHA256} from './customer-account-b7-contract.mjs'
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..')
export async function buildB7Site({window:state}={}) {
 const bytes=await readFile(join(root,'docs/customer-account-b7-execution-manifest-v2.json'))
 if(sha256(bytes)!==B7_MANIFEST_SHA256||state?.enabled!==false||state.startsAt!==null||state.endsAt!==null)throw Error('B7_BUILD_CLOSED_ONLY')
 const manifest=JSON.parse(bytes),stage=await mkdtemp(join(tmpdir(),'au-b7-stage-'))
 const tracked=spawnSync('git',['ls-files','-z'],{cwd:root,encoding:'utf8'});if(tracked.status!==0)throw Error('B7_TRACKED_FILES_FAILED')
 for(const path of tracked.stdout.split('\0').filter(p=>p.startsWith('src/')||p.startsWith('public/')||p.startsWith('appwrite-functions/reservation-api/src/')||p==='package.json')){await mkdir(dirname(join(stage,path)),{recursive:true});await cp(join(root,path),join(stage,path))}
 await mkdir(join(stage,'tools'),{recursive:true});await cp(join(root,'tools/customer-account-b7'),join(stage,'tools/customer-account-b7'),{recursive:true})
 // Test stage only: use the existing system-font fallback without external CSS imports.
 const tokens=join(stage,'src/styles/tokens.css')
 const tokenSource=await readFile(tokens,'utf8')
 const externalImports=/@import\s+url\(['"]https:\/\/(?:fonts\.googleapis\.com|cdn\.jsdelivr\.net)\/[^'"]+['"]\);\s*/g
 const localTokens=tokenSource.replace(externalImports,'')
 if(localTokens===tokenSource)throw Error('B7_FONT_IMPORT_CONTRACT_CHANGED')
 await writeFile(tokens,localTokens)
 await symlink(join(root,'node_modules'),join(stage,'node_modules'),'dir')
 // Observe the existing capture callback without rewriting UUIDs, forms, pricing or auth.
 const provider=join(stage,'src/CustomerAccountProvider.tsx'),source=await readFile(provider,'utf8'),needle='checkout.current=capture;'
 if(source.split(needle).length!==2)throw Error('B7_CAPTURE_CONTRACT_CHANGED')
 await writeFile(provider,source.replace(needle,needle+'(window as unknown as {__b7Capture: typeof capture}).__b7Capture=capture;'))
 const config={...manifest.proposedTemporaryState.frontendFlags,VITE_APPWRITE_ENDPOINT:manifest.target.endpoint,VITE_APPWRITE_PROJECT_ID:manifest.target.projectId,VITE_APPWRITE_CAKE_DATABASE_ID:'ca_test_cake_au',VITE_APPWRITE_KIDS_DATABASE_ID:'ca_test_kids_au'}
 await writeFile(join(stage,'index.html'),'<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>VERYGOOD AU Account TEST</title></head><body><div id="root"></div><script type="module" src="/tools/customer-account-b7/browser-entry.ts"></script></body></html>')
 await writeFile(join(stage,'b7-build.json'),JSON.stringify(config))
 const worker=`import {build} from 'vite';import react from '@vitejs/plugin-react';import {readFileSync} from 'node:fs';import {resolve} from 'node:path';const env=JSON.parse(readFileSync('b7-build.json','utf8'));await build({configFile:false,envDir:false,plugins:[react()],resolve:{alias:[{find:/^(.*\\/)?analytics(?:\\.[jt]s)?$/,replacement:resolve('tools/customer-account-b7/analytics-disabled.ts')}]},define:Object.fromEntries(Object.entries({...env,DEV:false,PROD:true,MODE:'production',BASE_URL:'/'}).map(([key,value])=>['import.meta.env.'+key,JSON.stringify(value)])),build:{target:'esnext',outDir:'dist'}})`
 await writeFile(join(stage,'build.mjs'),worker)
 const result=spawnSync(process.execPath,['build.mjs'],{cwd:stage,env:{PATH:process.env.PATH||'/usr/bin:/bin',HOME:process.env.HOME||'',TMPDIR:tmpdir()},encoding:'utf8',timeout:120000,maxBuffer:4*1024*1024})
 if(result.status!==0)throw Error('B7_BUILD_FAILED: '+String(result.stderr).slice(-1000))
 const directory=join(stage,'dist')
 await writeFile(join(directory,'test-window.json'),JSON.stringify(state))
 await writeFile(join(directory,'b7-public-config.json'),JSON.stringify(config))
 await writeFile(join(directory,'_headers'),'/*\n  X-Robots-Tag: noindex, nofollow\n  Referrer-Policy: no-referrer\n  Content-Security-Policy: default-src \'self\'; script-src \'self\'; style-src \'self\' \'unsafe-inline\'; img-src \'self\' data: https://api.verygood-chocolate.com; connect-src \'self\' https://api.verygood-chocolate.com; frame-src \'none\'; object-src \'none\'; base-uri \'self\'\n/test-window.json\n  Cache-Control: no-store\n')
 return {stage,directory}
}
