export const GOOGLE_ONLY_ORIGIN='https://au-account-test.verygood-chocolate.com'
export const GOOGLE_ONLY_PLAN_SHA256='9a938d7a5b86af5f17c12a61baddf73748565a9c4c7c9bb86ce41883046708ab'
export const GOOGLE_ONLY_USERS=Object.freeze({G:{id:'6ad38e4e0ffd5f810e23'},H:{id:'ca-test-customer-h-20261018'}})
/** @returns {never} */
const fail=()=>{throw Error('AUTH_UNAVAILABLE')}
export function assertGoogleOnlyWindow(w,{now=Date.now(),origin=GOOGLE_ONLY_ORIGIN}={}){
 if(origin!==GOOGLE_ONLY_ORIGIN||!w||Object.keys(w).sort().join(',')!=='enabled,endsAt,runId,startsAt'||w.enabled!==true||!Number.isSafeInteger(w.startsAt)||!Number.isSafeInteger(w.endsAt)||w.endsAt<=w.startsAt||w.endsAt-w.startsAt>900000||!/^google-only-[a-zA-Z0-9-]{1,60}$/.test(w.runId||'')||!Number.isFinite(now)||now<w.startsAt||now>=w.endsAt)fail()
 return w
}
function knownIdentity(identity){
 const found=Object.entries(GOOGLE_ONLY_USERS).find(([,u])=>u.id===identity?.userId)
 if(!found)fail();return found[0]
}
export function googleOnlySessionEvidence(user,session,now=Date.now()){
 const label=knownIdentity({userId:user?.$id,loginEmail:user?.email})
 if(user.status!==true||session?.userId!==user.$id||session.provider!=='google'||session.current!==true||!Number.isFinite(Date.parse(session.expire))||Date.parse(session.expire)<=now)fail()
 return {user:label,uidMatched:true,googleSession:true,sessionValid:true}
}
export async function checkGoogleOnlySession({account,readWindow,clock=Date.now}){
 await readWindow()
 const [user,session]=await Promise.allSettled([account.get(),account.getSession({sessionId:'current'})])
 if(user.status==='rejected'&&session.status==='rejected'&&user.reason?.code===401&&session.reason?.code===401)return {signedOut:true,accountDenied401:true,sessionDenied401:true}
 if(user.status!=='fulfilled'||session.status!=='fulfilled')fail()
 return googleOnlySessionEvidence(user.value,session.value,clock())
}
export function createGoogleOnlyAuth({base,readWindow,storage,origin=()=>location.origin,clock=Date.now}){
 const gate=async()=>assertGoogleOnlyWindow(await readWindow(),{now:clock(),origin:origin()})
 return {
  async restore(){await gate();const identity=await base.restore();if(identity)knownIdentity(identity);return identity},
  async startGoogle(options){const w=await gate(),key='google-only:'+w.runId+':oauth',count=Number(storage.getItem(key)||'0');if(!Number.isSafeInteger(count)||count<0||count>=4)fail();storage.setItem(key,String(count+1));return base.startGoogle(options)},
  async sendEmail(){fail()},async verifyEmail(){fail()},
  async signOut(){return base.signOut()},
  async saveProfile(profile,uid){
   const w=await gate(),label=Object.keys(GOOGLE_ONLY_USERS).find(k=>GOOGLE_ONLY_USERS[k].id===uid)
   if(!label||profile?.version!==1||profile.name!=='Google Test '+label||profile.contactEmail!==label.toLowerCase()+'-contact@example.invalid'||profile.phone!==''||!['en','ko'].includes(profile.language))fail()
   const key='google-only:'+w.runId+':prefs:'+uid,count=Number(storage.getItem(key)||'0')
   if(!Number.isSafeInteger(count)||count<0||count>=2)fail()
   storage.setItem(key,String(count+1));return base.saveProfile(profile,uid)
  },
 }
}
