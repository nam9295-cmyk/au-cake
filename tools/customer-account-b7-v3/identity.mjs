// Account factory must construct a JWT-only client. No Owner cookie or dynamic API key.
export function createB7IdentityVerifier({accountFactory}) {
 if(typeof accountFactory!=='function')throw Error('B7_IDENTITY_CONFIGURATION_REJECTED')
 return async({id,jwt})=>{
  if(!['6ad38e4e0ffd5f810e23','ca-test-customer-h-20261018'].includes(id)||typeof jwt!=='string'||!jwt||jwt.length>8192)throw Error('B7_IDENTITY_REJECTED')
  try{
   const user=await accountFactory({endpoint:'https://api.verygood-chocolate.com/v1',projectId:'verygood-au-account-test',jwt}).get()
   if(user?.$id!==id||user.status!==true)throw Error()
   return {$id:user.$id,status:true}
  }catch{throw Error('B7_IDENTITY_REJECTED')}
 }
}
