// Synthetic official-API boundary only. Never reads local credentials or calls a provider.
import {GOOGLE_TEST_TARGET as target} from '../../../scripts/customer-account-google-test.mjs'
export const G='6ad38e4e0ffd5f810e23',H='ca-test-customer-h-20261018',M='ca-test-admin-m-20261017'
export const now=Date.parse('2026-10-18T10:00:00Z')
export const window={enabled:true,startsAt:now,endsAt:now+900000,runId:'google-only-diagnostics-local'}
export const proof={kind:'GOOGLE_ONLY',startAuthorized:true,planSha256:'9a938d7a5b86af5f17c12a61baddf73748565a9c4c7c9bb86ce41883046708ab',window}
export function managementFixture(){
 const project={$id:target.projectId,teamId:'69bf44eb000f319a38a2',serviceStatusForAccount:false,authLimit:2,authEmailPassword:false,authPhone:false,authUsersAuthMagicURL:false,authEmailOtp:false,authAnonymous:false,authInvites:false,authJWT:false,authSessionAlerts:false,oAuthProviders:[{key:'google',enabled:true}]}
 const fn={$id:'ca-test-reservation-api',enabled:false,execute:[],deploymentId:'6ad41e576cb7a8f346af',runtime:'node-22',events:[],schedule:''}
 const variables=['CUSTOMER_ACCOUNT_ENABLED','AU_RENEWAL_WRITES_ENABLED','AU_RENEWAL_PREORDERS_ENABLED',...Array.from({length:27},(_,i)=>'EXISTING_'+i)].map(key=>({$id:key,key,value:'false',secret:false}))
 const sessions={[M]:[],[G]:[],[H]:[]},executions={total:18,executions:[]},writes=[]
 const transport=async(url,options)=>{
  const path=new URL(url).pathname.slice(3);let value
  if(options.method!=='GET')writes.push({path,method:options.method})
  if(path==='/projects/'+target.projectId)value=project
  else if(path.endsWith('/platforms'))value={total:1,platforms:[{hostname:new URL(target.origin).hostname,type:'web'}]}
  else if(path==='/users')value={total:3,users:[M,G,H].map($id=>({$id,status:true}))}
  else if(/^\/users\/[^/]+\/sessions$/.test(path))value={total:sessions[path.split('/')[2]].length,sessions:sessions[path.split('/')[2]]}
  else if(path.endsWith('/executions'))value=executions
  else if(path==='/functions/'+fn.$id)value=fn
  else if(path.endsWith('/variables'))value={total:variables.length,variables}
  else if(path.endsWith('/service')&&options.method==='PATCH'){project.serviceStatusForAccount=JSON.parse(options.body).status;value=project}
  else throw Error('Synthetic route not allowed')
  return new Response(JSON.stringify(value))
 }
 return {project,fn,variables,sessions,executions,writes,transport}
}
