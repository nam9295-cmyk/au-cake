export {CUSTOMER_OWNER_ATTRIBUTE,CUSTOMER_OWNER_INDEX} from '../appwrite-functions/reservation-api/src/customer-account-readiness.js'
import {CUSTOMER_OWNER_ATTRIBUTE,CUSTOMER_OWNER_INDEX,resolveCustomerAccountResources,assertCustomerPrivateAcl,assertCustomerPublicReadOnlyAcl,assertCustomerOwnerAttribute,assertCustomerOwnerIndex} from '../appwrite-functions/reservation-api/src/customer-account-readiness.js'

export function customerAccountSetupDefinitions(env) {
  const market=String(env.VITE_MARKET||env.MARKET||'KR').toUpperCase()
  if(market!=='AU'||env.CUSTOMER_ACCOUNT_ENABLED!=='true') return {attributes:[],indexes:[]}
  resolveCustomerAccountResources({...env,MARKET:market})
  if(env.APPWRITE_RESERVATION_WRITE_MODE==='direct') throw Error('Customer accounts require function-only reservation writes')
  return {attributes:[CUSTOMER_OWNER_ATTRIBUTE],indexes:[CUSTOMER_OWNER_INDEX]}
}

export function buildCustomerAccountMigrationPlan(env,metadata) {
  const resources=resolveCustomerAccountResources({...env,MARKET:env.CUSTOMER_ACCOUNT_MIGRATION_MARKET})
  for(const [i,target] of resources.privacyAuditTargets.entries()) {
    if(!metadata.collections[i]) throw Error('CUSTOMER_ACCOUNT_INCOMPLETE_INVENTORY')
    assertCustomerPrivateAcl(metadata.collections[i],resources.adminUserIds)
    if(metadata.collections[i].$id && metadata.collections[i].$id!==target.collectionId) throw Error('CUSTOMER_ACCOUNT_INVALID_RESOURCE')
  }
  for(const [i,target] of resources.publicReadTargets.entries()) {
    if(!metadata.publicCollections?.[i])throw Error('CUSTOMER_ACCOUNT_INCOMPLETE_INVENTORY')
    assertCustomerPublicReadOnlyAcl(metadata.publicCollections[i],resources.adminUserIds)
    if(metadata.publicCollections[i].$id&&metadata.publicCollections[i].$id!==target.collectionId)throw Error('CUSTOMER_ACCOUNT_INVALID_RESOURCE')
  }
  if(metadata.attribute) assertCustomerOwnerAttribute(metadata.attribute,{pending:true})
  if(metadata.index) assertCustomerOwnerIndex(metadata.index,{pending:true})
  return {ownershipTarget:resources.ownershipTarget,changes:[...(!metadata.attribute?[{kind:'attribute',...CUSTOMER_OWNER_ATTRIBUTE}]:[]),...(!metadata.index?[{kind:'index',...CUSTOMER_OWNER_INDEX}]:[])]}
}
