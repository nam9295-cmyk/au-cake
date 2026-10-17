import {ID,OAuthProvider,type Account} from 'appwrite'
import {account as sharedAccount} from './appwrite'
import type {CustomerIdentity,CustomerProfile} from './customer-account-types'
import {readCustomerProfile,validateCustomerProfile,mergeCustomerPreferences} from './customer-profile'
export type CustomerAuthAccount=Pick<Account,'get'|'getSession'|'createEmailToken'|'createSession'|'createOAuth2Session'|'deleteSession'|'getPrefs'|'updatePrefs'>
function fail(code:string):never {throw new Error(code)}
function safeError(error:unknown,fallback='AUTH_UNAVAILABLE'):never {
  const code=(error as {code?:number})?.code
  if(code===429)fail('AUTH_RATE_LIMITED')
  if(error instanceof Error&&/^(AUTH_|OTP_|INVALID_|ACCOUNT_SWITCH_REQUIRED)/.test(error.message)&&/^[A-Z_]+$/.test(error.message))throw error
  return fail(fallback)
}
export function createCustomerAuth({account=sharedAccount,idFactory=()=>ID.unique(),now=()=>Date.now(),origin=()=>window.location.origin}:{account?:CustomerAuthAccount;idFactory?:()=>string;now?:()=>number;origin?:()=>string}={}) {
  let pending:Promise<unknown>|null=null,signingOut=false,epoch=0,retryAt=0
  let challenge:{userId:string;expire:string}|null=null
  function exclusive<T>(op:(generation:number)=>Promise<T>):Promise<T> {
    if(pending||signingOut)return Promise.reject(new Error('AUTH_BUSY'))
    const generation=epoch
    const run=op(generation).then(result=>{if(epoch!==generation)fail('AUTH_CANCELLED');return result}).catch(error=>safeError(error)).finally(()=>{if(pending===run)pending=null})
    pending=run;return run
  }
  async function restore():Promise<CustomerIdentity|null> {
    try {
      const user=await account.get()
      if(user.status!==true)return null
      const session=await account.getSession({sessionId:'current'})
      if(!Number.isFinite(Date.parse(session.expire)))fail('AUTH_UNAVAILABLE')
      if(Date.parse(session.expire)<=now())return null
      if(session.userId&&session.userId!==user.$id)fail('AUTH_SESSION_CHANGED')
      return {userId:user.$id,loginEmail:user.email,profile:readCustomerProfile(user)}
    } catch(error) {
      if((error as {code?:number})?.code===401)return null
      return safeError(error)
    }
  }
  async function ensureGuest() {if(await restore())fail('ACCOUNT_SWITCH_REQUIRED')}
  return {
    restore,
    sendEmail(email:string) {
      return exclusive(async generation=>{
        const normalized=email.trim().toLowerCase()
        if(normalized.length>120||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized))fail('INVALID_EMAIL')
        if(now()<retryAt)fail('OTP_COOLDOWN')
        await ensureGuest();retryAt=now()+60000
        try {
          const token=await account.createEmailToken({userId:idFactory(),email:normalized})
          if(generation!==epoch)fail('AUTH_CANCELLED')
          if(!token.userId||!Number.isFinite(Date.parse(token.expire))||Date.parse(token.expire)<=now())fail('AUTH_UNAVAILABLE')
          challenge={userId:token.userId,expire:token.expire}
          return {...challenge,retryAt}
        } catch(error) {return safeError(error)}
      })
    },
    verifyEmail({userId,code}:{userId:string;code:string}) {
      return exclusive(async()=>{
        if(!/^\d{6}$/.test(code)||!challenge||challenge.userId!==userId)fail('INVALID_OTP')
        if(Date.parse(challenge.expire)<=now())fail('OTP_EXPIRED')
        await ensureGuest()
        try {
          await account.createSession({userId,secret:code})
          const identity=await restore()
          if(!identity||identity.userId!==userId)fail('AUTH_SESSION_CHANGED')
          challenge=null;return identity
        } catch(error) {return safeError(error,'AUTH_INVALID_OTP')}
      })
    },
    startGoogle({flowId}:{flowId:string}) {
      return exclusive(async()=>{
        if(!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(flowId))fail('INVALID_AUTH_FLOW')
        await ensureGuest()
        const base=new URL(origin())
        if(!['http:','https:'].includes(base.protocol)||base.username||base.password||base.pathname!=='/'||base.search||base.hash)fail('INVALID_AUTH_FLOW')
        const callback=new URL('/account/auth/callback',base)
        callback.searchParams.set('flowId',flowId)
        try {account.createOAuth2Session({provider:OAuthProvider.Google,success:callback.href,failure:callback.href})}
        catch(error) {safeError(error)}
      })
    },
    async signOut() {
      if(signingOut)fail('AUTH_BUSY')
      signingOut=true;epoch++;challenge=null
      try {
        // Explicit logout waits for in-flight session creation before revoking it.
        await pending?.catch(()=>{})
        try {await account.deleteSession({sessionId:'current'})}catch(error){if((error as {code?:number})?.code!==401)safeError(error)}
      } finally {signingOut=false}
    },
    saveProfile(input:CustomerProfile,expectedUserId:string) {
      return exclusive(async generation=>{
        const profile=validateCustomerProfile(input)
        const identity=await restore();if(!identity||identity.userId!==expectedUserId)fail('AUTH_SESSION_CHANGED')
        const prefs=await account.getPrefs()
        const current=await account.get()
        if(generation!==epoch||current.$id!==identity.userId)fail('AUTH_SESSION_CHANGED')
        try {
          await account.updatePrefs({prefs:mergeCustomerPreferences(prefs,profile)})
          return {...identity,profile}
        } catch(error) {return safeError(error)}
      })
    },
  }
}
export type CustomerAuth=ReturnType<typeof createCustomerAuth>
