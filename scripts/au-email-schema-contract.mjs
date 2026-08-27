export const AU_EMAIL_CAKE_RESERVATION_ATTRIBUTES = Object.freeze([
  Object.freeze({ key: 'customerEmail', type: 'string', size: 120, required: false }),
])

export const AU_EMAIL_REMINDER_INDEXES = Object.freeze({
  cake: Object.freeze([
    Object.freeze({ key: 'status_pickupDate_idx', type: 'key', attributes: Object.freeze(['status', 'pickupDate']) }),
  ]),
  classFirst: Object.freeze([
    Object.freeze({ key: 'status_classDate_idx', type: 'key', attributes: Object.freeze(['status', 'classDate']) }),
  ]),
  classAdvanced: Object.freeze([
    Object.freeze({ key: 'status_advancedClassDate_idx', type: 'key', attributes: Object.freeze(['status', 'advancedClassDate']) }),
  ]),
})
