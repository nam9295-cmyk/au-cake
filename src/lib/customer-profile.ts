import type {CustomerProfile} from './customer-account-types'
export const CUSTOMER_PROFILE_KEY='verygoodAuCustomer'
const emailPattern=/^[^\s@]+@[^\s@]+\.[^\s@]+$/
export function normalizeCustomerPhone(value:string):string {
  let phone=value.replace(/[\s()-]/g,'')
  if(phone.startsWith('+61'))phone=`0${phone.slice(3)}`
  else if(phone.startsWith('61')&&phone.length===11)phone=`0${phone.slice(2)}`
  return phone
}
export function validateCustomerProfile(input:unknown):CustomerProfile {
  const p=input as CustomerProfile
  if(!p||p.version!==1||typeof p.name!=='string'||typeof p.contactEmail!=='string'||typeof p.phone!=='string'||!['en','ko'].includes(p.language))throw new Error('INVALID_CUSTOMER_PROFILE')
  const name=p.name.trim(),contactEmail=p.contactEmail.trim().toLowerCase(),phone=normalizeCustomerPhone(p.phone)
  if(name.length<2||name.length>80||contactEmail.length>120||!emailPattern.test(contactEmail)||(phone!==''&&!/^04\d{8}$/.test(phone)))throw new Error('INVALID_CUSTOMER_PROFILE')
  return {version:1,name,contactEmail,phone,language:p.language}
}
export function readCustomerProfile(record:{name?:string;email?:string;prefs?:Record<string,unknown>}):CustomerProfile {
  const stored=record.prefs?.[CUSTOMER_PROFILE_KEY]
  if(stored) {try{return validateCustomerProfile(stored)}catch{/* Invalid or future preference versions use Account defaults. */}}
  return {version:1,name:(record.name||'').trim().slice(0,80),contactEmail:(record.email||'').trim().toLowerCase(),phone:'',language:'en'}
}
export function mergeCustomerPreferences(prefs:Record<string,unknown>,profile:CustomerProfile):Record<string,unknown> {
  return {...prefs,[CUSTOMER_PROFILE_KEY]:validateCustomerProfile(profile)}
}
