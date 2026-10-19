// Pure read-only projection. Hashes are evidence, never approval of a new baseline.
import {createHash} from 'node:crypto'
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value
const digest=value=>createHash('sha256').update(JSON.stringify(stable(value))).digest('hex')
export function semanticSettingsEvidence(project){
 if(!project||typeof project!=='object'||typeof project.$id!=='string')throw Error('PROJECT_SETTINGS_REQUIRED')
 const fields=Object.fromEntries(Object.keys(project).sort().filter(key=>/^(?:auth|smtp|serviceStatus)/.test(key)||key==='oAuthProviders').map(key=>[key,key==='oAuthProviders'&&Array.isArray(project[key])?[...project[key]].sort((a,b)=>String(a.key).localeCompare(String(b.key))):project[key]]))
 return {projectId:project.$id,sha256:digest(fields),fieldSha256:Object.fromEntries(Object.entries(fields).map(([key,value])=>[key,digest(value)])),historicalEquivalenceProven:false}
}
