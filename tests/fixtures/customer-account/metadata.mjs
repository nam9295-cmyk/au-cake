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
  return {
    getVersion:async()=>({version:'1.8.1'}),getDatabase:async()=>({$id:'cake-db'}),
    list:async()=>({databases:[{$id:'cake-db'},{$id:'kids-db'}],total:2}),
    listCollections:async({databaseId})=>({collections:(databaseId==='cake-db'?['reservations','review_invites','reviews','review_coupons','manual_coupons','review_photo_cleanup','email_deliveries','email_delivery_retry_claims','settings','cake_pickup_openings']:databaseId==='kids-db'?['class_reservations','class_booked_dates']:[]).map($id=>({$id})),total:databaseId==='cake-db'?10:databaseId==='kids-db'?2:0}),
    getCollection:async()=>({enabled:true,documentSecurity:false,$permissions:['read("user:admin-a")','update("user:admin-b")']}),
    getAttribute:async()=>({...ownerAttribute}),getIndex:async()=>({...ownerIndex}),...overrides,
  }
}
