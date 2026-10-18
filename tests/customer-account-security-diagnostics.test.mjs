import test from 'node:test'
import assert from 'node:assert/strict'
const api=await import('../scripts/security/safe-process-inventory.mjs').catch(()=>({}))
test('diagnostics emit fixed executable labels and numeric metrics, never process titles or arguments',()=>{
 assert.equal(typeof api.safeProcessSummary,'function')
 const credential='synthetic-DO-NOT-EMIT-private-credential'
 const result=api.safeProcessSummary([{pid:12,path:'/usr/local/bin/node',title:'npm exec '+credential,args:[credential]},{pid:13,path:'/secret-'+credential+'/custom-'+credential,title:credential}])
 assert.deepEqual(result,[{pid:12,executable:'node'},{pid:13,executable:'other'}]);assert.equal(JSON.stringify(result).includes(credential),false)
})
