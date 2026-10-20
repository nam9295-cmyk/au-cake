import {Query} from 'node-appwrite'
import {ReservationApiError} from './reservation-error.js'
import {resolveCustomerIdentity} from './customer-identity.js'

const identifier=/^[A-Za-z0-9][A-Za-z0-9._-]{0,35}$/
const control=/[\x00-\x1f\x7f]/
const fail=(code,status)=>{throw new ReservationApiError(code,status)}
const unavailable=()=>fail('ADMIN_MEMBERS_UNAVAILABLE',503)
function adminIds(env) {
  const ids=[...new Set(String(env.REVIEW_ADMIN_USER_IDS||'').split(',').map(v=>v.trim()).filter(Boolean))].sort()
  if(!ids.length||ids.some(id=>!identifier.test(id)))unavailable()
  if(env.APPWRITE_ADMIN_USER_IDS!==undefined) {
    const audit=[...new Set(String(env.APPWRITE_ADMIN_USER_IDS).split(',').map(v=>v.trim()).filter(Boolean))].sort()
    // Review administration can include additional legacy IDs. Member access
    // stays limited to existing DB administrators who are also review admins.
    if(!audit.length||audit.some(id=>!identifier.test(id)||!ids.includes(id)))unavailable()
    return new Set(audit)
  }
  return new Set(ids)
}
const safeText=(value,max)=>typeof value==='string'&&value.length<=max&&!control.test(value)?value.trim():''
const email=value=>{const text=safeText(value,320);return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)?text:''}
function projectMember(user,admins) {
  if(!user||typeof user.$id!=='string'||!identifier.test(user.$id)||typeof user.status!=='boolean'||typeof user.$createdAt!=='string'||!/^\d{4}-\d{2}-\d{2}T/.test(user.$createdAt)||!Number.isFinite(Date.parse(user.$createdAt)))unavailable()
  const p=user.prefs?.verygoodAuCustomer,profile=p&&p.version===1?p:{},phone=safeText(profile.phone,32)
  return {
    id:user.$id,name:safeText(profile.name,80)||safeText(user.name,128),loginEmail:email(user.email),
    contactEmail:email(profile.contactEmail)||email(user.email),phone:/^04\d{8}$/.test(phone)?phone:'',
    joinedAt:user.$createdAt,status:user.status?'active':'blocked',role:admins.has(user.$id)?'admin':'customer',
  }
}

export async function listAdminMembers({headers,env,accountForJwt,users,data}) {
  // Verify the platform JWT before calling the privileged Users API.
  const {userId}=await resolveCustomerIdentity({headers,env,accountForJwt})
  const admins=adminIds(env)
  if(!admins.has(userId))fail('ADMIN_MEMBERS_FORBIDDEN',403)
  const input=data===undefined?{}:data
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['search','cursor'].includes(k)))fail('INVALID_ADMIN_MEMBERS_REQUEST',400)
  if(input.cursor!==undefined&&(typeof input.cursor!=='string'||!identifier.test(input.cursor)))fail('INVALID_ADMIN_MEMBERS_REQUEST',400)
  if(input.search!==undefined&&(typeof input.search!=='string'||input.search.length>100||control.test(input.search)))fail('INVALID_ADMIN_MEMBERS_REQUEST',400)
  const search=(input.search||'').trim(),queries=[Query.limit(26),Query.orderDesc('$createdAt')]
  if(input.cursor)queries.push(Query.cursorAfter(input.cursor))
  try {
    const result=await users.list({queries,...(search?{search}:{}),total:true})
    if(!Array.isArray(result.users)||result.users.length>26||!Number.isSafeInteger(result.total)||result.total<result.users.length)unavailable()
    const ids=result.users.map(u=>u?.$id)
    if(new Set(ids).size!==ids.length)unavailable()
    const members=result.users.slice(0,25).map(user=>projectMember(user,admins))
    return {members,total:result.total,nextCursor:result.users.length>25?members.at(-1).id:null}
  } catch {unavailable()}
}
