import {rolldown} from 'rolldown'
import {mkdir,readFile,writeFile} from 'node:fs/promises'
import {fileURLToPath} from 'node:url'
import {resolve} from 'node:path'
import {GOOGLE_TEST_TARGET,assertGoogleTestTarget} from './customer-account-google-test.mjs'
export async function googleTestSiteArtifacts({target,windowConfig={enabled:false,endsAt:null}}){
 assertGoogleTestTarget(target)
 if(windowConfig.enabled!==false&&!(windowConfig.enabled===true&&Date.parse(windowConfig.endsAt)>Date.now()&&Date.parse(windowConfig.endsAt)-Date.now()<=30*60000))throw Error('INVALID_TEST_WINDOW')
 const root=new URL('../tools/customer-account-google-smoke/',import.meta.url)
 const bundle=await rolldown({input:fileURLToPath(new URL('app.mjs',root)),platform:'browser'})
 let chunk;try{const result=await bundle.generate({format:'esm',codeSplitting:false,minify:true});chunk=result.output.find(c=>c.type==='chunk'&&c.isEntry)}finally{await bundle.close()}
 const index=await readFile(new URL('index.html',root),'utf8'),css=await readFile(new URL('style.css',root),'utf8')
 return {files:{'index.html':index,'success/index.html':index,'failed/index.html':index,'style.css':css,'app.js':chunk.code,'404.html':'<!doctype html><meta charset="utf-8"><meta name="robots" content="noindex,nofollow"><title>Not found</title><h1>Not found</h1>','test-window.json':JSON.stringify(windowConfig),'robots.txt':'User-agent: *\nDisallow: /\n','_headers':`/*\n  Cache-Control: no-store\n  Referrer-Policy: no-referrer\n  X-Content-Type-Options: nosniff\n  X-Robots-Tag: noindex, nofollow, noarchive\n  Content-Security-Policy: default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self' https://api.verygood-chocolate.com; base-uri 'none'; frame-ancestors 'none'; form-action 'none'\n`},inputs:Object.keys(chunk.modules)}
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const dir=resolve(fileURLToPath(new URL('../.superpowers/sdd/2026-10-17-customer-account-very-server-test/b3-auth/site/',import.meta.url)))
 const config=process.argv[2]?JSON.parse(await readFile(process.argv[2],'utf8')):{enabled:false,endsAt:null}
 const artifacts=await googleTestSiteArtifacts({target:GOOGLE_TEST_TARGET,windowConfig:config})
 for(const[name,value]of Object.entries(artifacts.files)){const destination=resolve(dir,name);await mkdir(resolve(destination,'..'),{recursive:true});await writeFile(destination,value)}
 console.log(JSON.stringify({outputDirectory:dir,files:Object.keys(artifacts.files),enabled:config.enabled}))
}
