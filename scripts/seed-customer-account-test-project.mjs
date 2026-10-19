import {resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {assertCustomerAccountTestTarget,assertCustomerAccountTestResource} from './customer-account-test-target.mjs'
import {customerAccountTestBaseline,CUSTOMER_ACCOUNT_TEST_SETTINGS} from './customer-account-test-baseline.mjs'
import {CUSTOMER_OWNER_ATTRIBUTE,CUSTOMER_OWNER_INDEX} from './customer-account-schema.mjs'
export const CUSTOMER_ACCOUNT_TEST_ADMIN_UID='ca-test-admin-m-20261017' // Reserved, not yet created.
function freeze(value) {
  if(value&&typeof value==='object'){for(const child of Object.values(value)) freeze(child);Object.freeze(value)}
  return value
}
export function buildCustomerAccountTestSeedPlan({target:input,adminUserIds,runId}={}) {
  const target=assertCustomerAccountTestTarget(input)
  if(target.resources.databaseIds.length!==2||target.resources.functionIds.length!==0||!Array.isArray(adminUserIds)||adminUserIds.length!==1||adminUserIds[0]!==CUSTOMER_ACCOUNT_TEST_ADMIN_UID||typeof runId!=='string'||!/^\d{8}-[a-z0-9-]{1,8}$/.test(runId)) throw Error('CUSTOMER_ACCOUNT_TEST_SEED_REJECTED')
  const collections=customerAccountTestBaseline(adminUserIds[0])
  for(const c of collections) assertCustomerAccountTestResource(target,{databaseId:c.databaseId,collectionId:c.collectionId})
  const env={
    APPWRITE_ENDPOINT:target.endpoint,APPWRITE_PROJECT_ID:target.projectId,MARKET:'AU',CUSTOMER_ACCOUNT_MIGRATION_MARKET:'AU',
    APPWRITE_CAKE_DATABASE_ID:'ca_test_cake_au',APPWRITE_KIDS_DATABASE_ID:'ca_test_kids_au',APPWRITE_CAKE_RESERVATIONS_TABLE_ID:'reservations',
    APPWRITE_KIDS_RESERVATIONS_TABLE_ID:'class_reservations',APPWRITE_KIDS_BOOKED_DATES_TABLE_ID:'class_booked_dates',APPWRITE_SETTINGS_TABLE_ID:'settings',APPWRITE_CAKE_PICKUP_OPENINGS_TABLE_ID:'cake_pickup_openings',
    APPWRITE_ADMIN_USER_IDS:adminUserIds[0],REVIEW_ADMIN_USER_IDS:adminUserIds[0],APPWRITE_RESERVATION_WRITE_MODE:'function',
    CUSTOMER_ACCOUNT_ENABLED:'false',VITE_CUSTOMER_ACCOUNT_ENABLED:'false',
  }
  return freeze(structuredClone({mode:'offline-dry-run',network:false,target,runId,adminUserIds,
    creates:{databases:[{databaseId:'ca_test_cake_au',name:'CA TEST Cake AU',enabled:true},{databaseId:'ca_test_kids_au',name:'CA TEST Kids baseline AU',enabled:true}],collections},
    env,
    fixtures:[{databaseId:'ca_test_cake_au',collectionId:'settings',documentId:`ca-settings-${runId}`,permissions:[],data:{...CUSTOMER_ACCOUNT_TEST_SETTINGS}}],
    migration:{target:{databaseId:'ca_test_cake_au',collectionId:'reservations'},attribute:CUSTOMER_OWNER_ATTRIBUTE,index:CUSTOMER_OWNER_INDEX},
  }))
}
// No apply implementation in this phase. No dotenv, API key, remote client or network call.
export function customerAccountTestSeedCli(args) {
  const values={}
  for(let i=0;i<args.length;i++) {
    const option=args[i]
    if(option==='--dry-run'){if(values.dryRun)throw Error('duplicate');values.dryRun=true;continue}
    if(!['--endpoint','--project-id','--admin-user-id','--run-id'].includes(option)||values[option]!==undefined||!args[i+1]||args[i+1].startsWith('--')) throw Error('explicit inputs required; apply is unavailable')
    values[option]=args[++i]
  }
  return buildCustomerAccountTestSeedPlan({target:{endpoint:values['--endpoint'],projectId:values['--project-id'],resources:{databaseIds:['ca_test_cake_au','ca_test_kids_au'],functionIds:[]}},adminUserIds:[values['--admin-user-id']],runId:values['--run-id']})
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try { console.log(JSON.stringify(customerAccountTestSeedCli(process.argv.slice(2)),null,2)) }
  catch { console.error('CUSTOMER_ACCOUNT_TEST_SEED_REJECTED: explicit test inputs required; offline dry-run only.');process.exitCode=1 }
}
