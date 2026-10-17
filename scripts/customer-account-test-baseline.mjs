// Test-only schema snapshot from setup-appwrite.mjs; importing the full setup is unsafe.
// Review/email definitions are shared declarative contracts, never operating metadata exports.
import {AU_EMAIL_CAKE_RESERVATION_ATTRIBUTES,AU_EMAIL_REMINDER_INDEXES} from './au-email-schema-contract.mjs'
import {RESERVATION_REVIEW_AUDIT_ATTRIBUTES,RESERVATION_MULTI_LINE_ATTRIBUTES,REVIEW_COLLECTIONS,toAppwriteIndexCreate} from './review-schema.mjs'
export const CUSTOMER_ACCOUNT_TEST_SETTINGS = Object.freeze({
  price:45,bankName:'TEST ONLY',bankAccount:'TEST ONLY - DO NOT PAY',accountHolder:'CA TEST',
  weekdayOpen:'10:00',weekdayClose:'20:00',weekendOpen:'10:00',weekendClose:'17:00',
  dailyLimitText:'TEST ONLY',reservationNotice:'TEST ONLY - no payment or delivery',pickupNotice:'TEST ONLY',storeAddress:'TEST ONLY',storePhone:'TEST ONLY',
})
const defaultSettings=CUSTOMER_ACCOUNT_TEST_SETTINGS
const reservationAttributes = [
  { key: 'reservationNumber', type: 'string', size: 40, required: true },
  { key: 'customerName', type: 'string', size: 80, required: true },
  { key: 'customerPhone', type: 'string', size: 40, required: true },
  // Keep optional so historic cake reservations without email remain readable.
  ...AU_EMAIL_CAKE_RESERVATION_ATTRIBUTES,
  { key: 'productId', type: 'string', size: 40, required: false },
  { key: 'cakeSize', type: 'string', size: 20, required: false },
  { key: 'chocolateType', type: 'string', size: 20, required: false },
  { key: 'poundAddon', type: 'string', size: 40, required: false },
  { key: 'cupcakeFinish', type: 'string', size: 40, required: false },
  { key: 'chocolateIcingCount', type: 'integer', required: false, min: 0, max: 12 },
  { key: 'vanillaCreamCount', type: 'integer', required: false, min: 0, max: 12 },
  { key: 'partyDecorationCount', type: 'integer', required: false, min: 0, max: 12 },
  { key: 'vanillaCakeSheet', type: 'string', size: 20, required: false },
  { key: 'vanillaCakeFlavor', type: 'string', size: 40, required: false },
  // Storage technical ceiling only; normal cake business max=5 stays in product validation.
  { key: 'quantity', type: 'integer', required: false, min: 1, max: 2147483647 },
  { key: 'pickupDate', type: 'string', size: 20, required: true },
  { key: 'pickupTime', type: 'string', size: 10, required: true },
  { key: 'cacaoPercent', type: 'string', size: 10, required: true },
  { key: 'requestNote', type: 'string', size: 1000, required: false },
  { key: 'adminMemo', type: 'string', size: 1000, required: false },
  { key: 'createdAt', type: 'string', size: 40, required: true },
  { key: 'updatedAt', type: 'string', size: 40, required: false },
  {
    key: 'status',
    type: 'enum',
    required: true,
    elements: ['예약신청', '예약확정', '픽업완료', '취소'],
  },
  {
    key: 'paymentStatus',
    type: 'enum',
    required: true,
    elements: ['입금대기', '입금확인', '현장결제', '환불필요'],
  },
  { key: 'totalPrice', type: 'integer', required: true, min: 0 },
  { key: 'totalPriceCents', type: 'integer', required: false, min: 0 },
  ...RESERVATION_REVIEW_AUDIT_ATTRIBUTES,
  ...RESERVATION_MULTI_LINE_ATTRIBUTES,
]

const settingsAttributes = [
  { key: 'price', type: 'integer', required: true, min: 0 },
  ...Object.keys(defaultSettings)
    .filter((key) => key !== 'price')
    .map((key) => ({
      key,
      type: 'string',
      size: key.includes('Notice') ? 1000 : 200,
      required: true,
    })),
]

const cakePickupOpeningAttributes = [
  { key: 'pickupDate', type: 'string', size: 20, required: true },
  { key: 'pickupTime', type: 'string', size: 10, required: true },
  { key: 'createdAt', type: 'string', size: 40, required: true },
]

const classReservationAttributes = [
  { key: 'reservationNumber', type: 'string', size: 48, required: true },
  { key: 'classType', type: 'string', size: 80, required: true },
  { key: 'classDate', type: 'string', size: 20, required: true },
  { key: 'classTime', type: 'string', size: 20, required: true },
  { key: 'coursePlan', type: 'enum', required: false, elements: ['basic', 'advanced', 'basic-advanced-package'] },
  { key: 'extensionMinutes', type: 'integer', required: false, min: 0, max: 30 },
  { key: 'advancedClassDate', type: 'string', size: 20, required: false },
  { key: 'advancedClassTime', type: 'string', size: 20, required: false },
  { key: 'advancedExtensionMinutes', type: 'integer', required: false, min: 0, max: 30 },
  { key: 'durationMinutes', type: 'integer', required: false, min: 90, max: 150 },
  { key: 'advancedDurationMinutes', type: 'integer', required: false, min: 120, max: 150 },
  { key: 'bookingType', type: 'enum', required: true, elements: ['year-1-2', '1-child', '2-friends'] },
  { key: 'parentName', type: 'string', size: 80, required: true },
  { key: 'parentPhone', type: 'string', size: 40, required: true },
  { key: 'parentEmail', type: 'string', size: 120, required: true },
  { key: 'childName', type: 'string', size: 80, required: true },
  { key: 'childAge', type: 'integer', required: true, min: 3, max: 18 },
  { key: 'schoolYear', type: 'string', size: 40, required: true },
  { key: 'secondChildName', type: 'string', size: 80, required: false },
  { key: 'secondChildAge', type: 'integer', required: false, min: 3, max: 18 },
  { key: 'secondChildSchoolYear', type: 'string', size: 40, required: false },
  { key: 'allergyNote', type: 'string', size: 1000, required: false },
  { key: 'emergencyContact', type: 'string', size: 120, required: true },
  { key: 'pickupPerson', type: 'string', size: 80, required: true },
  { key: 'parentConsent', type: 'boolean', required: true },
  { key: 'cancellationAgreement', type: 'boolean', required: true },
  { key: 'photoConsent', type: 'boolean', required: true },
  { key: 'status', type: 'enum', required: true, elements: ['Requested', 'Confirmed', 'Completed', 'Cancelled'] },
  {
    key: 'paymentStatus',
    type: 'enum',
    required: true,
    elements: ['Payment pending', 'Fully paid', 'Refund required', 'Pending deposit', 'Deposit paid'],
  },
  { key: 'totalPrice', type: 'integer', required: true, min: 0 },
  { key: 'subtotalCents', type: 'integer', required: false, min: 0 },
  { key: 'discountPercent', type: 'integer', required: false, min: 0, max: 100 },
  { key: 'discountCents', type: 'integer', required: false, min: 0 },
  { key: 'totalPriceCents', type: 'integer', required: false, min: 0 },
  { key: 'depositAmount', type: 'integer', required: true, min: 0 },
  { key: 'adminMemo', type: 'string', size: 1000, required: false },
  { key: 'createdAt', type: 'string', size: 40, required: true },
  { key: 'updatedAt', type: 'string', size: 40, required: false },
]

const classBookedDateAttributes = [
  { key: 'classDate', type: 'string', size: 20, required: true },
  { key: 'classTime', type: 'string', size: 20, required: false },
  { key: 'durationMinutes', type: 'integer', required: false, min: 90, max: 150 },
  { key: 'createdAt', type: 'string', size: 40, required: true },
]

const reservationIndexes = [
  { key: 'reservationNumber_idx', attributes: ['reservationNumber'] },
  { key: 'pickupDate_idx', attributes: ['pickupDate'] },
  { key: 'status_idx', attributes: ['status'] },
  ...AU_EMAIL_REMINDER_INDEXES.cake,
  { key: 'paymentStatus_idx', attributes: ['paymentStatus'] },
  { key: 'cacaoPercent_idx', attributes: ['cacaoPercent'] },
  { key: 'createdAt_idx', attributes: ['createdAt'] },
]

const cakePickupOpeningIndexes = [
  { key: 'pickupSlot_unique', attributes: ['pickupDate', 'pickupTime'], type: 'unique' },
  { key: 'pickupDate_idx', attributes: ['pickupDate'] },
]

const classReservationIndexes = [
  { key: 'reservationNumber_idx', attributes: ['reservationNumber'] },
  { key: 'classDate_idx', attributes: ['classDate'] },
  { key: 'advancedClassDate_idx', attributes: ['advancedClassDate'] },
  { key: 'status_idx', attributes: ['status'] },
  ...AU_EMAIL_REMINDER_INDEXES.classFirst,
  ...AU_EMAIL_REMINDER_INDEXES.classAdvanced,
  { key: 'paymentStatus_idx', attributes: ['paymentStatus'] },
  { key: 'createdAt_idx', attributes: ['createdAt'] },
]

const classBookedDateIndexes = [
  { key: 'classSlot_unique', attributes: ['classDate', 'classTime'], type: 'unique' },
  { key: 'classDate_idx', attributes: ['classDate'] },
]
const permissions=(actions,uid)=>actions.map(action=>`${action}("user:${uid}")`)
const normalizeAttribute=({xdefault,...a})=>({...a,...(xdefault===undefined?{}:{default:xdefault})})
export function customerAccountTestBaseline(adminUid) {
  const admin=permissions(['create','read','update','delete'],adminUid)
  const publicRead=['read("any")',...permissions(['create','update','delete'],adminUid)]
  const definitions=[
    ['ca_test_cake_au','reservations',reservationAttributes,reservationIndexes,admin],
    ['ca_test_cake_au','cake_pickup_openings',cakePickupOpeningAttributes,cakePickupOpeningIndexes,publicRead],
    ['ca_test_cake_au','settings',settingsAttributes,[],publicRead],
    ...Object.values(REVIEW_COLLECTIONS).map(d=>['ca_test_cake_au',d.name,d.attributes,d.indexes,permissions(d.adminPermissions,adminUid)]),
    ['ca_test_kids_au','class_reservations',classReservationAttributes,classReservationIndexes,admin],
    ['ca_test_kids_au','class_booked_dates',classBookedDateAttributes,classBookedDateIndexes,publicRead],
  ]
  return definitions.map(([databaseId,collectionId,attributes,indexes,acl])=>({databaseId,collectionId,name:collectionId,enabled:true,documentSecurity:false,permissions:[...acl],attributes:attributes.map(normalizeAttribute),indexes:indexes.map(i=>({...toAppwriteIndexCreate(i),orders:i.orders||i.attributes.map(()=>'ASC')}))}))
}
