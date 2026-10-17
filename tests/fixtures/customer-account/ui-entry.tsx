import React,{StrictMode} from 'react'
import {createRoot} from 'react-dom/client'
import {CustomerAccountProvider} from '../../../src/CustomerAccountProvider'
import {useCustomerAccount} from '../../../src/lib/customer-account-context'
import type {CustomerAuth} from '../../../src/lib/customer-auth'
import type {CustomerIdentity} from '../../../src/lib/customer-account-types'
import '../../../src/index.css'
const who:CustomerIdentity={userId:'customer-a',loginEmail:'login@example.test',profile:{version:1,name:'Customer A',contactEmail:'contact@example.test',phone:'0412345678',language:'en'}}
let current:CustomerIdentity|null=null,mode='guest',calls=0,healthCalls=0,ready=true,enabled=true
const restores:Array<(identity:CustomerIdentity|null)=>void>=[],verifications:Array<(identity:CustomerIdentity)=>void>=[]
const auth={
  async restore(){calls++;if(mode==='pending')return new Promise<CustomerIdentity|null>(r=>restores.push(r));return current},
  async sendEmail(){calls++;return {userId:'customer-a',expire:'2099-01-01T00:00:00Z',retryAt:Date.now()+60000}},
  async verifyEmail(){calls++;return new Promise<CustomerIdentity>(r=>verifications.push(r))},
  async startGoogle(){calls++;throw Error('AUTH_UNAVAILABLE')},
  async signOut(){calls++;current=null;mode='guest'},
  async saveProfile(profile){return {...who,profile}},
} satisfies CustomerAuth
const health=async()=>{healthCalls++;return {enabled:true,ready}}
export function Probe(){const customer=useCustomerAccount();return <><output id="state">{customer.state.status}{customer.state.status==='authenticated'?`:${customer.state.identity.userId}`:''}</output><button id="signin" onClick={customer.openSignIn}>Sign in</button><button id="logout" onClick={()=>void customer.signOut()}>Sign out</button><button id="refresh" onClick={()=>void customer.refresh()}>Refresh</button><input id="order-name" defaultValue="Already typed"/></>}
const root=createRoot(document.getElementById('root')!)
function render(){root.render(<StrictMode><CustomerAccountProvider enabled={enabled} auth={auth} health={health}><Probe/></CustomerAccountProvider></StrictMode>)}
declare global{interface Window{customerAccountTest:{reset:(options?:{enabled?:boolean;ready?:boolean;mode?:string})=>void;resolveRestore:()=>void;resolveVerify:()=>void;invalidate:()=>void;switchIdentity:()=>void;counts:()=>{calls:number;healthCalls:number};unmount:()=>void}}}
window.customerAccountTest={
  reset(options={}){enabled=options.enabled??true;ready=options.ready??true;mode=options.mode??'guest';current=null;calls=0;healthCalls=0;render()},
  resolveRestore(){mode='guest';for(const resolve of restores.splice(0))resolve(who)},
  resolveVerify(){for(const resolve of verifications.splice(0))resolve(who)},
  invalidate(){window.dispatchEvent(new Event('verygood:auth-changed'))},
  switchIdentity(){current={...who,userId:'customer-b'};window.dispatchEvent(new Event('focus'))},
  counts:()=>({calls,healthCalls}),unmount:()=>root.unmount(),
}
render()
