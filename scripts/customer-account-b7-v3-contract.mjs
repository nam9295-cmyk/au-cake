// V3 preparation only: no transport, no writer, no execution authorization fallback.
import {createHash} from 'node:crypto'
export const B7_V3_MANIFEST_SHA256='1c4245230e8bd89e72548bc0573ca158247462e93a8b427cdaa175d84b4d7c90'
export function inspectB7V3VariableState({manifestBytes,variables,phase}){
 const reject=()=>{throw Error('B7_V3_VARIABLES_NOT_READY')}
 if(!Buffer.isBuffer(manifestBytes)||createHash('sha256').update(manifestBytes).digest('hex')!==B7_V3_MANIFEST_SHA256||!Array.isArray(variables)||!['prepare','approvedWindow','closed'].includes(phase))reject()
 const m=JSON.parse(manifestBytes),keys=m.newFunctionVariableNames,contract=m.functionVariableContract
 if(m.executionApproved!==false||m.manifestVersion!==3||m.proposedWrites.functionVariablesAddedMax!==7||keys.length!==7||new Set(keys).size!==7||contract.requireExplicitPresence!==true||contract.missingOrImplicitDefaultMeansReady!==false)reject()
 const rows=new Map()
 for(const row of variables){if(!row||typeof row.key!=='string'||rows.has(row.key))reject();rows.set(row.key,row)}
 for(const row of rows.values()){if(row.key.startsWith('B7_TEST_')&&!keys.includes(row.key))reject()}
 for(const key of keys){const row=rows.get(key);if(!row||row.secret!==contract.secretNames.includes(key)||!row.secret&&typeof row.value!=='string')reject()}
 for(const [key,value] of Object.entries(contract.phaseFlags[phase])){const row=rows.get(key);if(!row||row.secret!==false||row.value!==value)reject()}
 if(rows.get('B7_TEST_RUN_ID').value!==m.runId||!/^[a-f\d]{64}$/.test(rows.get('B7_TEST_FIXTURE_MANIFEST_SHA256').value||''))reject()
 const start=rows.get('B7_TEST_STARTS_AT').value,end=rows.get('B7_TEST_ENDS_AT').value
 if(phase==='prepare'&&(start!=='0'||end!=='0'))reject()
 if(phase==='approvedWindow'&&(!/^\d{13}$/.test(start)||!/^\d{13}$/.test(end)||Number(end)<=Number(start)||Number(end)-Number(start)>m.window.maxSeconds*1000))reject()
 return {requiredNewVariableCount:7,explicitVariablesPresent:true,phase,secretReadbackNotVerified:true,remoteWritesAllowed:false}
}
