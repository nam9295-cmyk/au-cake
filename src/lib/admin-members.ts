import {executeReservationApi} from './repository'

export type AdminMember={id:string;name:string;loginEmail:string;contactEmail:string;phone:string;joinedAt:string;status:'active'|'blocked';role:'admin'|'customer'}
export type AdminMembersPage={members:AdminMember[];total:number;nextCursor:string|null}
export type AdminMembersQuery={search?:string;cursor?:string}
type Execute=(action:string,data:unknown,parse:(value:unknown)=>AdminMembersPage)=>Promise<AdminMembersPage>
const idPattern=/^[A-Za-z0-9][A-Za-z0-9._-]{0,35}$/
const hasControl=(value:string)=>[...value].some(char=>char.charCodeAt(0)<32||char.charCodeAt(0)===127)
function invalid():never{throw Error('INVALID_ADMIN_MEMBERS_RESPONSE')}
function object(value:unknown,keys:string[]):Record<string,unknown>{
  if(!value||typeof value!=='object'||Array.isArray(value))invalid()
  const row=value as Record<string,unknown>
  if(Object.keys(row).length!==keys.length||Object.keys(row).some(k=>!keys.includes(k)))invalid()
  return row
}
export function parseAdminMembersPage(value:unknown):AdminMembersPage {
  const page=object(value,['members','total','nextCursor'])
  if(!Array.isArray(page.members)||page.members.length>25||!Number.isSafeInteger(page.total)||Number(page.total)<page.members.length)invalid()
  if(page.nextCursor!==null&&(typeof page.nextCursor!=='string'||!idPattern.test(page.nextCursor)))invalid()
  const members=page.members.map(value=>{
    const row=object(value,['id','name','loginEmail','contactEmail','phone','joinedAt','status','role'])
    for(const key of ['id','name','loginEmail','contactEmail','phone','joinedAt'])if(typeof row[key]!=='string'||String(row[key]).length>320||hasControl(String(row[key])))invalid()
    if(!idPattern.test(String(row.id))||!Number.isFinite(Date.parse(String(row.joinedAt)))||!['active','blocked'].includes(String(row.status))||!['admin','customer'].includes(String(row.role)))invalid()
    return row as AdminMember
  })
  if(new Set(members.map(m=>m.id)).size!==members.length)invalid()
  return {members,total:Number(page.total),nextCursor:page.nextCursor as string|null}
}
export async function listAdminMembers(query:AdminMembersQuery={},execute:Execute=executeReservationApi):Promise<AdminMembersPage> {
  if(query.cursor!==undefined&&!idPattern.test(query.cursor)||query.search!==undefined&&(query.search.length>100||hasControl(query.search)))throw Error('INVALID_ADMIN_MEMBERS_REQUEST')
  const data={...(query.search?.trim()?{search:query.search.trim()}:{}),...(query.cursor?{cursor:query.cursor}:{})}
  let timer:ReturnType<typeof setTimeout>|undefined
  try {
    return await Promise.race([execute('list-admin-members',data,parseAdminMembersPage),new Promise<never>((_resolve,reject)=>{timer=setTimeout(()=>reject(Error('ADMIN_MEMBERS_UNAVAILABLE')),10000)})])
  }finally{clearTimeout(timer)}
}
