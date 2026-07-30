import { useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { BankAccountBox } from '../components/BankAccountBox'
import { SiteHeader } from '../components/SiteChrome'
import { WeekendDatePicker } from '../components/WeekendDatePicker'
import { useTodayInputValue } from '../hooks/useTodayInputValue'
import { type Page } from '../lib/app-routes'
import { trackEvent } from '../lib/analytics'
import {
  calculateClassPricing,
  CLASS_EXTENSION_WARNING,
  CLASS_PAYMENT_SETTINGS,
  CLASS_SESSION_TIMES,
  getAvailableClassSessionTimes,
  getClassAgeGroupForSchoolYear,
  getClassBookingType,
  getClassCoursePlanLabel,
  getClassDurationMinutes,
  getClassSchoolYears,
  getClassTypeLabel,
  isClassDateBooked,
  isClassSchoolYearAllowed,
  isWeekendClassDate,
  normalizeClassReservationInput,
  type ClassBookedSlot,
} from '../lib/class-utils'
import { marketConfig } from '../lib/market'
import { createClassReservation, listClassBookedSlots } from '../lib/repository'
import type {
  ClassCoursePlan,
  ClassExtensionMinutes,
  ClassPartySize,
  ClassReservation,
  ClassType,
} from '../lib/types'
import {
  addDaysInputValue,
  formatCurrency,
  generateRequestId,
  isValidPhone,
  normalizePhone,
} from '../lib/utils'

function nextWeekendClassDate() {
  for (let offset = 0; offset < 8; offset += 1) {
    const value = addDaysInputValue(offset)
    if (isWeekendClassDate(value)) return value
  }
  return addDaysInputValue(1)
}

export function ClassReservePage({ navigate, onComplete, cartItemCount }: { navigate: (page: Page) => void; onComplete: (reservation: ClassReservation) => void; cartItemCount: number }) {
  const [requestId] = useState(generateRequestId)
  const [form, setForm] = useState<{
    classDate: string
    classTime: string
    coursePlan: ClassCoursePlan
    extensionMinutes: ClassExtensionMinutes
    advancedClassDate: string
    advancedClassTime: string
    advancedExtensionMinutes: ClassExtensionMinutes
    classType: ClassType
    partySize: ClassPartySize
    parentName: string
    parentPhone: string
    parentEmail: string
    childName: string
    childAge: number
    schoolYear: string
    secondChildName: string
    secondChildAge: number
    secondChildSchoolYear: string
    allergyNote: string
    emergencyContact: string
    pickupPerson: string
    parentConsent: boolean
    cancellationAgreement: boolean
    photoConsent: boolean
    privacyConsent: boolean
    website: string
  }>({
    classDate: nextWeekendClassDate(),
    classTime: CLASS_SESSION_TIMES[0],
    coursePlan: 'basic',
    extensionMinutes: 0,
    advancedClassDate: nextWeekendClassDate(),
    advancedClassTime: CLASS_SESSION_TIMES[1],
    advancedExtensionMinutes: 0,
    classType: 'school-holiday-private-cake-class',
    partySize: 1,
    parentName: '',
    parentPhone: '',
    parentEmail: '',
    childName: '',
    childAge: 7,
    schoolYear: 'Year 2',
    secondChildName: '',
    secondChildAge: 9,
    secondChildSchoolYear: '',
    allergyNote: '',
    emergencyContact: '',
    pickupPerson: '',
    parentConsent: false,
    cancellationAgreement: false,
    photoConsent: false,
    privacyConsent: false,
    website: '',
  })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [bookedClassSlots, setBookedClassSlots] = useState<ClassBookedSlot[]>([])
  const [availabilityLoaded, setAvailabilityLoaded] = useState(false)
  const [availabilityError, setAvailabilityError] = useState(false)
  const today = useTodayInputValue()
  const oneChildOnly = form.coursePlan !== 'basic'
  const partySize = oneChildOnly ? 1 : form.partySize
  const schoolYears = getClassSchoolYears(form.coursePlan)
  const selectedAgeGroup = getClassAgeGroupForSchoolYear(form.schoolYear)
  const bookingType = getClassBookingType(selectedAgeGroup, partySize)
  const pricing = calculateClassPricing({
    coursePlan: form.coursePlan,
    bookingType,
    extensionMinutes: form.extensionMinutes,
    advancedExtensionMinutes: form.advancedExtensionMinutes,
  })
  const price = pricing.totalPriceCents / 100
  const availableSessionTimes = getAvailableClassSessionTimes(form.classDate, bookedClassSlots)
  const selectedDateBooked = isClassDateBooked(form.classDate, bookedClassSlots)
  const advancedAvailableSessionTimes = getAvailableClassSessionTimes(form.advancedClassDate, bookedClassSlots)
  const advancedSelectedUnavailable = form.coursePlan === 'basic-advanced-package' &&
    !advancedAvailableSessionTimes.includes(form.advancedClassTime as (typeof CLASS_SESSION_TIMES)[number])

  useEffect(() => {
    listClassBookedSlots()
      .then((classSlots) => {
        setBookedClassSlots(classSlots)
        setAvailabilityError(false)
      })
      .catch(() => {
        setBookedClassSlots([])
        setAvailabilityError(true)
      })
      .finally(() => setAvailabilityLoaded(true))
  }, [])

  async function submitClassReservation(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    const phone = normalizePhone(form.parentPhone)
    if (!form.parentName.trim() || !form.childName.trim()) return setError('Please enter parent and child name.')
    if (!isClassSchoolYearAllowed(form.coursePlan, form.schoolYear)) return setError(form.coursePlan === 'basic' ? 'Please choose a school year from Kindy to Year 6.' : 'Advanced classes are available from Year 2 to Year 6.')
    if (!isValidPhone(phone)) return setError(`Please check the mobile number. ${marketConfig.copy.phoneHelp}`)
    if (!form.parentEmail.includes('@')) return setError('Please enter a valid email address.')
    if (!form.classDate || form.classDate < today || !isWeekendClassDate(form.classDate)) return setError('Please choose a Saturday or Sunday.')
    if (selectedDateBooked) return setError('This date is already booked. Please choose another date.')
    if (!availableSessionTimes.includes(form.classTime as (typeof CLASS_SESSION_TIMES)[number])) return setError('Please choose an available class time.')
    if (form.coursePlan === 'basic-advanced-package') {
      if (!form.advancedClassDate || form.advancedClassDate < today || !isWeekendClassDate(form.advancedClassDate)) return setError('Please choose a Saturday or Sunday for the Advanced session.')
      if (advancedSelectedUnavailable || (form.advancedClassDate === form.classDate && form.advancedClassTime === form.classTime)) return setError('Please choose a different available Advanced session.')
    }
    if (partySize === 2 && (!form.secondChildName.trim() || !isClassSchoolYearAllowed('basic', form.secondChildSchoolYear))) return setError('Please enter Child 2 name and choose a school year from Kindy to Year 6.')
    if (!form.emergencyContact.trim() || !form.pickupPerson.trim()) return setError('Emergency contact and pick-up person are required.')
    if (!form.parentConsent || !form.cancellationAgreement || !form.privacyConsent) return setError('Parent, privacy, and booking agreements are required.')
    setSubmitting(true)
    try {
      const reservation = await createClassReservation(normalizeClassReservationInput({
        ...form,
        classType: form.coursePlan === 'advanced' ? 'advanced-2-tier-cake-class' : form.classType,
        bookingType,
        parentPhone: phone,
        requestId,
      }))
      trackEvent('class_booking_request', {
        booking_type: bookingType,
        class_type: form.classType,
        course_plan: form.coursePlan,
        value: price,
        currency: 'AUD',
      })
      onComplete(reservation)
      navigate('class-complete')
    } catch (submitError) {
      if (submitError instanceof Error && (submitError.message === 'CLASS_SESSION_UNAVAILABLE' || submitError.message === 'CLASS_DATE_UNAVAILABLE')) {
        setError('This session time is already booked. Please choose another time or date.')
      } else {
        setError('An error occurred while submitting your class request. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <SiteHeader navigate={navigate} cartItemCount={cartItemCount} />
      <main className="class-reserve-page">
        <form className="class-reserve-form" onSubmit={submitClassReservation}>
          <label className="website-field" aria-hidden="true">
            Leave this field blank
            <input name="website" value={form.website} onChange={(event) => setForm({ ...form, website: event.target.value })} tabIndex={-1} autoComplete="off" />
          </label>
          <header className="class-reserve-title-block">
            <button className="class-back-button" type="button" onClick={() => navigate('classes')}>
              <ArrowLeft size={14} /> Back to classes
            </button>
            <h1>Request a Kids Course</h1>
            <p>Please fill out the details below. Jenny will confirm availability and send full payment details.</p>
          </header>

          <section className="class-form-section" aria-labelledby="course-plan-title">
            <h2 id="course-plan-title">1. Choose a Plan</h2>
            <div className="class-booking-grid">
              {([
                ['basic', 'Basic'],
                ['advanced', 'Advanced'],
                ['basic-advanced-package', 'Basic + Advanced Package'],
              ] as const).map(([coursePlan, label]) => (
                <label className="class-option-card" key={coursePlan}>
                  <input
                    type="radio"
                    name="coursePlan"
                    checked={form.coursePlan === coursePlan}
                    onChange={() => setForm({
                      ...form,
                      coursePlan,
                      partySize: coursePlan === 'basic' ? form.partySize : 1,
                      schoolYear: isClassSchoolYearAllowed(coursePlan, form.schoolYear) ? form.schoolYear : 'Year 2',
                      classType: coursePlan === 'advanced' ? 'advanced-2-tier-cake-class' : form.classType === 'advanced-2-tier-cake-class' ? 'school-holiday-private-cake-class' : form.classType,
                    })}
                  />
                  <span>{label}</span>
                  <strong>{coursePlan === 'advanced' ? 'One child · 2-tier cake' : coursePlan === 'basic-advanced-package' ? 'One child · two weekend sessions' : 'Cake or cupcakes · 1–2 children'}</strong>
                </label>
              ))}
            </div>
          </section>

          {form.coursePlan !== 'advanced' && (
            <section className="class-form-section" aria-labelledby="course-type-title">
              <h2 id="course-type-title">2. Choose a Basic Class</h2>
              <div className="class-booking-grid class-two-option-grid">
                {(['school-holiday-private-cake-class', 'cupcake-chocolate-class'] as const).map((classType) => (
                  <label className="class-option-card" key={classType}>
                    <input type="radio" name="classType" checked={form.classType === classType} onChange={() => setForm({ ...form, classType })} />
                    <span>{getClassTypeLabel(classType)}</span>
                    <strong>{classType === 'cupcake-chocolate-class' ? '4 cupcakes + chocolate making' : 'One 15cm chocolate cake'}</strong>
                  </label>
                ))}
              </div>
            </section>
          )}

          <section className="class-form-section" aria-labelledby="school-group-title">
            <h2 id="school-group-title">3. Choose School Group</h2>
            {form.coursePlan === 'basic' ? (
              <>
                <p>Basic · Kindy–Year 6</p>
                <div className="class-booking-grid class-two-option-grid">
                  <label className="class-option-card">
                    <input
                      type="radio"
                      name="classSchoolGroup"
                      checked={selectedAgeGroup === 'kindy-year-2' || selectedAgeGroup === 'year-2'}
                      onChange={() => setForm({ ...form, schoolYear: ['Kindy', 'Year 1', 'Year 2'].includes(form.schoolYear) ? form.schoolYear : 'Kindy' })}
                    />
                    <span>Kindy–Year 2</span>
                    <strong>Younger students</strong>
                  </label>
                  <label className="class-option-card">
                    <input
                      type="radio"
                      name="classSchoolGroup"
                      checked={selectedAgeGroup === 'year-3-6'}
                      onChange={() => setForm({ ...form, schoolYear: ['Year 3', 'Year 4', 'Year 5', 'Year 6'].includes(form.schoolYear) ? form.schoolYear : 'Year 3' })}
                    />
                    <span>Year 3–6</span>
                    <strong>Primary students</strong>
                  </label>
                </div>
              </>
            ) : (
              <p>Advanced · Year 2–6 only</p>
            )}
          </section>

          <section className="class-form-section" aria-labelledby="children-count-title">
            <h2 id="children-count-title">4. Number of Children</h2>
            {oneChildOnly ? <p>Advanced and package bookings are for one child only.</p> : (
              <div className="class-booking-grid class-two-option-grid">
                {([1, 2] as const).map((nextPartySize) => (
                  <label className="class-option-card" key={nextPartySize}>
                    <input type="radio" name="classPartySize" checked={form.partySize === nextPartySize} onChange={() => setForm({ ...form, partySize: nextPartySize })} />
                    <span>{nextPartySize === 1 ? '1 child' : '2 children / siblings / friends'}</span>
                    <strong>{nextPartySize === 1 ? 'Private session' : 'Learn together'}</strong>
                  </label>
                ))}
              </div>
            )}
          </section>

          <section className="class-form-section class-form-section-tight" aria-labelledby="session-detail-title">
            <h2 id="session-detail-title">5. {form.coursePlan === 'advanced' ? 'Advanced' : 'Basic'} Weekend Session · {getClassDurationMinutes(form.coursePlan === 'advanced' ? 'advanced' : 'basic', form.extensionMinutes)} minutes</h2>
            <div className="class-field">
              <span>Preferred Date</span>
              <WeekendDatePicker
                label="Preferred Date"
                value={form.classDate}
                minDate={today}
                onChange={(nextDate) => {
                  const nextAvailableTimes = getAvailableClassSessionTimes(nextDate, bookedClassSlots)
                  setForm({ ...form, classDate: nextDate, classTime: nextAvailableTimes[0] || CLASS_SESSION_TIMES[0] })
                }}
              />
            </div>
            <fieldset className="class-time-fieldset">
              <legend>Preferred Session Time</legend>
              <div className="class-time-grid">
                {availableSessionTimes.length > 0 ? availableSessionTimes.map((time) => (
                  <label className="class-time-option" key={time}>
                    <input
                      type="radio"
                      name="classTime"
                      checked={form.classTime === time}
                      onChange={() => setForm({ ...form, classTime: time })}
                    />
                    <span>{time}</span>
                  </label>
                )) : (
                  <p className="class-availability-note unavailable">This date is already booked. Please choose another date.</p>
                )}
              </div>
              {availabilityLoaded && availabilityError && <p className="class-availability-note unavailable">Availability could not be loaded. Jenny will double-check this session before confirming.</p>}
              {availabilityLoaded && !availabilityError && !selectedDateBooked && <p className="class-availability-note">Available: {availableSessionTimes.join(' / ')}</p>}
            </fieldset>
            <p className="field-help">Saturday and Sunday only.</p>
            <label className="class-check-row">
              <input type="checkbox" checked={form.extensionMinutes === 30} onChange={(event) => setForm({ ...form, extensionMinutes: event.target.checked ? 30 : 0 })} />
              <span>Add 30 minutes to this class</span>
            </label>
            {form.extensionMinutes === 30 && <p className="class-availability-note warning">{CLASS_EXTENSION_WARNING}</p>}

            {form.coursePlan === 'basic-advanced-package' && (
              <div className="class-package-session">
                <h3>Advanced Weekend Session · {getClassDurationMinutes('advanced', form.advancedExtensionMinutes)} minutes</h3>
                <div className="class-field">
                  <span>Advanced Date · Saturday or Sunday</span>
                  <WeekendDatePicker label="Advanced Date" minDate={today} value={form.advancedClassDate} onChange={(advancedClassDate) => {
                    const times = getAvailableClassSessionTimes(advancedClassDate, bookedClassSlots)
                    setForm({ ...form, advancedClassDate, advancedClassTime: times[0] || CLASS_SESSION_TIMES[0] })
                  }} />
                </div>
                <fieldset className="class-time-fieldset">
                  <legend>Advanced Session Time</legend>
                  <div className="class-time-grid">
                    {advancedAvailableSessionTimes.map((time) => (
                      <label className="class-time-option" key={`advanced-${time}`}>
                        <input type="radio" name="advancedClassTime" checked={form.advancedClassTime === time} onChange={() => setForm({ ...form, advancedClassTime: time })} />
                        <span>{time}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <label className="class-check-row">
                  <input type="checkbox" checked={form.advancedExtensionMinutes === 30} onChange={(event) => setForm({ ...form, advancedExtensionMinutes: event.target.checked ? 30 : 0 })} />
                  <span>Add 30 minutes to the Advanced class</span>
                </label>
                {form.advancedExtensionMinutes === 30 && <p className="class-availability-note warning">{CLASS_EXTENSION_WARNING}</p>}
              </div>
            )}
          </section>

          <section className="class-form-section" aria-labelledby="guardian-detail-title">
            <h2 id="guardian-detail-title">6. Parent / Guardian Details</h2>
            <label className="class-field">
              <span>Full Name</span>
              <input value={form.parentName} onChange={(event) => setForm({ ...form, parentName: event.target.value })} placeholder="Parent or guardian name" />
            </label>
            <label className="class-field">
              <span>Email Address</span>
              <input type="email" value={form.parentEmail} onChange={(event) => setForm({ ...form, parentEmail: event.target.value })} placeholder="name@email.com" />
            </label>
            <label className="class-field">
              <span>Mobile Number</span>
              <input inputMode="tel" value={form.parentPhone} onChange={(event) => setForm({ ...form, parentPhone: event.target.value })} placeholder="0412 345 678" />
            </label>
          </section>

          <section className="class-form-section" aria-labelledby="child-detail-title">
            <h2 id="child-detail-title">7. Child Details</h2>
            <label className="class-field">
              <span>Child 1 Name</span>
              <input value={form.childName} onChange={(event) => setForm({ ...form, childName: event.target.value })} placeholder="Leo" />
            </label>
            <div className="class-split-row">
              <label className="class-field">
                <span>Child 1 Age</span>
                <input type="number" min="3" max="18" value={form.childAge} onChange={(event) => setForm({ ...form, childAge: Number(event.target.value) })} />
              </label>
              <label className="class-field">
                <span>Child 1 School Year</span>
                <select value={form.schoolYear} onChange={(event) => setForm({ ...form, schoolYear: event.target.value })}>
                  {schoolYears.map((year) => <option value={year} key={year}>{year}</option>)}
                </select>
              </label>
            </div>
            {partySize === 2 && (
              <>
                <label className="class-field">
                  <span>Child 2 Name</span>
                  <input value={form.secondChildName} onChange={(event) => setForm({ ...form, secondChildName: event.target.value })} placeholder="Chloe" />
                </label>
                <div className="class-split-row">
                  <label className="class-field">
                    <span>Child 2 Age</span>
                    <input type="number" min="3" max="18" value={form.secondChildAge} onChange={(event) => setForm({ ...form, secondChildAge: Number(event.target.value) })} />
                  </label>
                  <label className="class-field">
                    <span>Child 2 School Year</span>
                    <select value={form.secondChildSchoolYear} onChange={(event) => setForm({ ...form, secondChildSchoolYear: event.target.value })}>
                      <option value="">Choose year</option>
                      {getClassSchoolYears('basic').map((year) => <option value={year} key={year}>{year}</option>)}
                    </select>
                  </label>
                </div>
              </>
            )}
          </section>

          <section className="class-form-section" aria-labelledby="safety-title">
            <h2 id="safety-title">8. Allergy & Safety Declarations</h2>
            <label className="class-field">
              <span>Allergy declarations & safety notes</span>
              <textarea value={form.allergyNote} onChange={(event) => setForm({ ...form, allergyNote: event.target.value })} placeholder="Please write known allergies, dietary notes, or none." />
            </label>
            <div className="class-split-row">
              <label className="class-field">
                <span>Emergency Contact</span>
                <input value={form.emergencyContact} onChange={(event) => setForm({ ...form, emergencyContact: event.target.value })} placeholder="Name and mobile" />
              </label>
              <label className="class-field">
                <span>Pick-up Person</span>
                <input value={form.pickupPerson} onChange={(event) => setForm({ ...form, pickupPerson: event.target.value })} placeholder="Who will pick up" />
              </label>
            </div>
          </section>

          <section className="class-form-section" aria-labelledby="consent-title">
            <h2 id="consent-title">9. Consent & Confirmation</h2>
            <label className="class-check-row">
              <input type="checkbox" checked={form.parentConsent} onChange={(event) => setForm({ ...form, parentConsent: event.target.checked })} />
              <span>I am the parent/guardian and consent to my child joining this class.</span>
            </label>
            <label className="class-check-row">
              <input type="checkbox" checked={form.cancellationAgreement} onChange={(event) => setForm({ ...form, cancellationAgreement: event.target.checked })} />
              <span>I understand my booking is completed only after availability is confirmed and full payment is received.</span>
            </label>
            <label className="class-check-row">
              <input type="checkbox" checked={form.privacyConsent} onChange={(event) => setForm({ ...form, privacyConsent: event.target.checked })} />
              <span>I agree that booking, contact, allergy and emergency details may be stored in Appwrite for class administration and sent through Resend for operator email notifications.</span>
            </label>
            <fieldset className="class-photo-consent">
              <legend>Photo Consent</legend>
              <div className="class-photo-options">
                <label>
                  <input type="radio" name="photoConsent" checked={form.photoConsent} onChange={() => setForm({ ...form, photoConsent: true })} />
                  <span>Yes, I consent to photos</span>
                </label>
                <label>
                  <input type="radio" name="photoConsent" checked={!form.photoConsent} onChange={() => setForm({ ...form, photoConsent: false })} />
                  <span>No, do not take photos</span>
                </label>
              </div>
            </fieldset>
          </section>

          <aside className="class-reserve-summary" aria-label="Class request summary">
            <dl>
              <div><dt>Plan</dt><dd>{getClassCoursePlanLabel(form.coursePlan)}</dd></div>
              <div><dt>Course</dt><dd>{form.coursePlan === 'advanced' ? 'Advanced 2-Tier Cake Class' : getClassTypeLabel(form.classType)}</dd></div>
              <div><dt>School year</dt><dd>{form.schoolYear}</dd></div>
              <div><dt>Children</dt><dd>{partySize}</dd></div>
              <div><dt>First session</dt><dd>{form.classDate} {form.classTime} · {getClassDurationMinutes(form.coursePlan === 'advanced' ? 'advanced' : 'basic', form.extensionMinutes)} min</dd></div>
              {form.coursePlan === 'basic-advanced-package' && <div><dt>Advanced session</dt><dd>{form.advancedClassDate} {form.advancedClassTime} · {getClassDurationMinutes('advanced', form.advancedExtensionMinutes)} min</dd></div>}
              <div><dt>Subtotal</dt><dd>{formatCurrency(pricing.subtotalCents / 100)}</dd></div>
              {pricing.discountCents > 0 && <div><dt>Package discount</dt><dd>{pricing.discountPercent}% · -{formatCurrency(pricing.discountCents / 100)}</dd></div>}
              <div><dt>Total</dt><dd>{formatCurrency(price)}</dd></div>
              <div><dt>Payment</dt><dd>Full payment required</dd></div>
            </dl>
            <BankAccountBox settings={CLASS_PAYMENT_SETTINGS} totalPrice={price} language="en" />
            <p className="class-submit-note">Use this account after Jenny confirms the session is available.</p>
          </aside>

          {error && <p className="error-text class-error-text">{error}</p>}
          <button className="class-submit-button" type="submit" disabled={submitting || selectedDateBooked}>{submitting ? 'Submitting...' : selectedDateBooked ? 'Date unavailable' : 'Request booking'}</button>
          <p className="class-submit-note">Jenny will confirm availability and send full payment details. Your booking is complete after payment is received.</p>
        </form>
      </main>
    </>
  )
}
