import {spawnSync} from 'node:child_process'
import {mkdtemp,rm,readdir} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve,basename} from 'node:path'
import {rolldown} from 'rolldown'

const supplied=process.argv.slice(2)
const files=supplied.length?supplied:(await readdir('tests')).filter(f=>f!=='customer-account-static.test.mjs'&&/^customer-(account|auth|profile|order|orders|checkout|admin).*\.test\.(ts|tsx|mjs)$/.test(f)).sort().map(f=>`tests/${f}`)
const dir=await mkdtemp(join(tmpdir(),'au-customer-tests-'))
try {
  const entries=[]
  for(const [i,file] of files.entries()) {
    if(file.endsWith('.mjs')) { entries.push(resolve(file)); continue }
    const out=join(dir,`${i}-${basename(file)}.mjs`)
    const env=file.endsWith('customer-admin-session.test.ts')?{VITE_MARKET:'AU',VITE_APPWRITE_ENDPOINT:'https://example.invalid/v1',VITE_APPWRITE_PROJECT_ID:'isolated-test',VITE_APPWRITE_CAKE_DATABASE_ID:'isolated-test',VITE_ADMIN_EMAILS:'admin@example.test',VITE_RESERVATION_API_MODE:'all'}:{VITE_MARKET:'AU'}
    const bundle=await rolldown({input:resolve(file),platform:'node',transform:{jsx:{runtime:'automatic'},define:{'import.meta.env':JSON.stringify(env)}},plugins:[{name:'test-assets',load(id){if(/\.(png|jpg|webp|svg)$/.test(id))return 'export default "test-image"'}}]})
    try {await bundle.write({file:out,format:'esm',codeSplitting:false})} finally {await bundle.close()}
    entries.push(out)
  }
  const run=spawnSync(process.execPath,['--test',...entries],{stdio:'inherit',env:{...process.env,VITE_MARKET:'AU'}})
  if(run.error) throw run.error
  process.exitCode=run.status??1
} finally { await rm(dir,{recursive:true,force:true}) }
