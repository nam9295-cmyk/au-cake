import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, mkdtemp, rm, symlink, access } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { join, dirname, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { pathToFileURL } from 'node:url'
import { createNotificationArchive } from '../scripts/reservation-notification-deploy-runtime.mjs'
import { createBookingReminderArchive } from '../scripts/booking-reminder-deploy-runtime.mjs'
import { createReviewApiArchive } from '../scripts/review-api-deploy-runtime.mjs'

for(const [name,create] of [['notification',createNotificationArchive],['reminder',createBookingReminderArchive],['review',createReviewApiArchive]]) test(`${name} deployment archive includes canonical manual reader and every transitive local import`,async()=>{
 const archive=await create({repositoryRoot:process.cwd()})
 const dir=await mkdtemp(join(tmpdir(),'manual-archive-test-'))
 try {
  execFileSync('tar',['-xzf',archive.path,'-C',dir])
  assert.equal(await readFile(join(dir,'shared/reservation-api/manual-order.js'),'utf8'),await readFile('appwrite-functions/reservation-api/src/manual-order.js','utf8'))
  const seen=new Set()
  async function visit(path){
   if(seen.has(path))return
   seen.add(path);const text=await readFile(path,'utf8')
   for(const [,specifier] of text.matchAll(/(?:from\s*|import\s*\(\s*)['"](\.[^'"]+)['"]/g)){
    const child=resolve(dirname(path),specifier);assert.ok(child.startsWith(dir+'/'),'local dependencies cannot escape archive');await access(child);await visit(child)
   }
  }
  await visit(join(dir,'src/main.js'))
  await symlink(resolve(name === 'review' ? 'appwrite-functions/review-api/node_modules' : 'node_modules'),join(dir,'node_modules'),'dir')
  await import(pathToFileURL(join(dir,'src/main.js')).href)
 } finally {await archive.cleanup();await rm(dir,{recursive:true,force:true})}
})
