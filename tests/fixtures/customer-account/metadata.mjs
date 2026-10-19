export const accountEnv = {
  MARKET:'AU',CUSTOMER_ACCOUNT_ENABLED:'true',APPWRITE_ADMIN_USER_IDS:'admin-a,admin-b,admin-a',
  APPWRITE_CAKE_DATABASE_ID:'cake-db',APPWRITE_CAKE_RESERVATIONS_TABLE_ID:'reservations',
  APPWRITE_KIDS_DATABASE_ID:'kids-db',APPWRITE_KIDS_RESERVATIONS_TABLE_ID:'class_reservations',
  APPWRITE_ENDPOINT:'https://appwrite.test.invalid/v1',APPWRITE_PROJECT_ID:'isolated-project',
  CUSTOMER_ACCOUNT_MIGRATION_MARKET:'AU',APPWRITE_API_KEY:'test-key',
}
export const ownerAttribute={key:'customerUserId',type:'string',size:36,required:false,array:false,status:'available',default:null}
export const ownerIndex={key:'customerUser_created_idx',type:'key',attributes:['customerUserId','$createdAt'],orders:['ASC','DESC'],status:'available'}
export function metadataDb(overrides={}) {
  const getCollection=overrides.getCollection|| (async()=>({enabled:true,documentSecurity:false,$permissions:['read("user:admin-a")','update("user:admin-b")']}))
  const byDatabase={
    'cake-db':['reservations','review_invites','reviews','review_coupons','manual_coupons','review_photo_cleanup','email_deliveries','email_delivery_retry_claims','settings','cake_pickup_openings'],
    'kids-db':['class_reservations','class_booked_dates'],
    'private-custom':['claims','snapshots','sessions','photos','quotas','outbox','commits','chunks','histories','ratelimits'],
  }
  const listCollections=overrides.listCollections|| (async({databaseId})=>{
    const ids=byDatabase[databaseId]||[]
    const collections=await Promise.all(ids.map(async $id=>({$id,...await getCollection({databaseId,collectionId:$id})})))
    return {collections,total:collections.length}
  })
  return {
    getVersion:async()=>({version:'1.8.1'}),getDatabase:async()=>({$id:'cake-db'}),
    list:async()=>({databases:[{$id:'cake-db'},{$id:'kids-db'}],total:2}),
    listCollections,
    getCollection,
    getAttribute:async()=>({...ownerAttribute}),getIndex:async()=>({...ownerIndex}),...overrides,
  }
}
