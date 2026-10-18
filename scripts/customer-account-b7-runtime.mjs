import {readFile,mkdir,cp,writeFile,lstat,readdir} from 'node:fs/promises'
import {join,resolve,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import {execFileSync} from 'node:child_process'
import {freezeB7Fixtures,sha256,B7_MANIFEST_SHA256} from './customer-account-b7-contract.mjs'
export {createB7IdentityVerifier} from '../tools/customer-account-b7/identity.mjs'
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..')
const ENTRY_SOURCE=`import original from './main.js';
import {Account,Client} from 'node-appwrite';
import {readFileSync} from 'node:fs';
import {createB7GuardedHandler} from './b7-guard.mjs';
import {createB7IdentityVerifier} from './b7-identity.mjs';
const verifyIdentity=createB7IdentityVerifier({accountFactory:({endpoint,projectId,jwt})=>new Account(new Client().setEndpoint(endpoint).setProject(projectId).setJWT(jwt))});
export default createB7GuardedHandler({handler:original,env:process.env,fixtureManifestBytes:readFileSync(new URL('./b7-fixtures.json',import.meta.url)),verifyIdentity});
`
// No install/network/deploy. Stage is create-only and contains no runtime credentials.
export async function packageB7Function({directory,fixtureManifestBytes}) {
 if(!Buffer.isBuffer(fixtureManifestBytes))throw Error('B7_PACKAGE_REJECTED')
 const f=JSON.parse(fixtureManifestBytes)
 const canonical=freezeB7Fixtures(f.createBodies.slice(0,6).map(x=>JSON.parse(x)))
 if(!canonical.equals(fixtureManifestBytes)||sha256(await readFile(join(root,'docs/customer-account-b7-execution-manifest-v2.json')))!==B7_MANIFEST_SHA256)throw Error('B7_PACKAGE_REJECTED')
 if(!directory||!(await lstat(directory)).isDirectory())throw Error('B7_PACKAGE_REJECTED')
 const stage=join(directory,'function-stage');await mkdir(stage,{mode:0o700})
 const base=join(root,'appwrite-functions/reservation-api')
 for(const name of ['package.json','package-lock.json','src','scripts/native-smoke.mjs'])await cp(join(base,name),join(stage,name),{recursive:true})
 for(const [source,name] of [['function-entry.mjs','b7-guard.mjs'],['identity.mjs','b7-identity.mjs']])await cp(join(root,'tools/customer-account-b7',source),join(stage,'src',name))
 await writeFile(join(stage,'src/b7-fixtures.json'),fixtureManifestBytes,{mode:0o600,flag:'wx'})
 await writeFile(join(stage,'src/b7-entry.mjs'),ENTRY_SOURCE,{mode:0o600,flag:'wx'})
 const archivePath=join(directory,'guarded-code.tar.gz')
 // Exclusive claim prevents a second archive from replacing this frozen preparation.
 await writeFile(archivePath+'.claim','B7 single archive\n',{flag:'wx',mode:0o600})
 execFileSync('tar',['-czf',archivePath,'package.json','package-lock.json','src','scripts/native-smoke.mjs'],{cwd:stage,timeout:15000})
 const archive=await readFile(archivePath)
 if(archive.length>2*1024*1024)throw Error('B7_ARCHIVE_TOO_LARGE')
 return {archive,archiveSha256:sha256(archive),fixtureSha256:sha256(fixtureManifestBytes),stage,archivePath,entrypoint:'src/b7-entry.mjs'}
}

// Verify source bytes, dependencies and every archive member before any deployment POST.
export async function verifyB7Archive(archive,fixtureSha256){
 const fail=()=>{throw Error('B7_ARCHIVE_REJECTED')}
 if(!Buffer.isBuffer(archive)||archive.length>2*1024*1024)fail()
 const tar=(args)=>{try{return execFileSync('tar',args,{input:archive,timeout:10000,maxBuffer:4*1024*1024,stdio:['pipe','pipe','ignore']})}catch{fail()}}
 const names=tar(['-tzf','-']).toString().trim().split('\n').filter(n=>!n.endsWith('/'))
 if(new Set(names).size!==names.length||names.some(n=>n.includes('..')||n.startsWith('/')))fail()
 const expected=new Map()
 const base=join(root,'appwrite-functions/reservation-api')
 async function walk(dir,prefix){for(const x of await readdir(dir,{withFileTypes:true})){if(x.isDirectory())await walk(join(dir,x.name),prefix+x.name+'/');else if(x.isFile())expected.set(prefix+x.name,await readFile(join(dir,x.name)));else fail()}}
 await walk(join(base,'src'),'src/')
 for(const name of ['package.json','package-lock.json','scripts/native-smoke.mjs'])expected.set(name,await readFile(join(base,name)))
 expected.set('src/b7-entry.mjs',Buffer.from(ENTRY_SOURCE))
 for(const [source,name] of [['function-entry.mjs','b7-guard.mjs'],['identity.mjs','b7-identity.mjs']])expected.set('src/'+name,await readFile(join(root,'tools/customer-account-b7',source)))
 const fixtures=tar(['-xOzf','-','src/b7-fixtures.json']);let f
 try{f=JSON.parse(fixtures);if(!freezeB7Fixtures(f.createBodies.slice(0,6).map(JSON.parse)).equals(fixtures)||sha256(fixtures)!==fixtureSha256)fail()}catch{fail()}
 expected.set('src/b7-fixtures.json',fixtures)
 if(names.length!==expected.size||names.some(name=>!expected.has(name)))fail()
 for(const [name,bytes] of expected)if(!tar(['-xOzf','-',name]).equals(bytes))fail()
 return true
}
