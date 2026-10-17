export const TEST_ORIGIN='https://au-account-test.verygood-chocolate.com'
export const TEST_ENDPOINT='https://api.verygood-chocolate.com/v1'
export const TEST_PROJECT='verygood-au-account-test'
export function googleSessionOptions(origin){if(origin!==TEST_ORIGIN)throw Error('TEST_ORIGIN_REQUIRED');return {provider:'google',success:TEST_ORIGIN+'/success/',failure:TEST_ORIGIN+'/failed/',scopes:[]}}
export function publicAccount(account){return {userId:account.$id,name:account.name,email:account.email,emailVerified:account.emailVerification===true}}
export function publicAuthError(error){const types=['general_service_disabled','user_unauthorized','general_unauthorized_scope','user_session_not_found'];return {status:Number.isInteger(error?.code)?error.code:0,type:types.includes(error?.type)?error.type:'authentication_error'}}
