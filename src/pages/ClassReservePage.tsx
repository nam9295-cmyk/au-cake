import { useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { BankAccountBox } from '../components/BankAccountBox'
import { SiteHeader } from '../components/SiteChrome'
import { WeekendDatePicker } from '../components/WeekendDatePicker'
import { useTodayInputValue } from '../hooks/useTodayInputValue'
import { type Page } from '../lib/app-routes'
import { trackEvent } from '../lib/analytics'
import {
  SPRING_CLASS_CAMPAIGN_2026,
  getNextSpringClassDate,
  getSpringClassCampaignCopy,
  isSpringClassBookingDateAllowed,
} from '../lib/class-campaign'
import {
  calculateClassPricing,
  CLASS_EXTENSION_WARNING,
  CLASS_PAYMENT_SETTINGS,
  CLASS_SESSION_TIMES,
  getAvailableClassSessionTimes,
  getClassAgeGroupForSchoolYear,
  getClassBookingType,
  getClassDurationMinutes,
  getClassSchoolYears,
  isClassDateBooked,
  isClassSchoolYearAllowed,
  normalizeClassReservationInput,
  type ClassBookedSlot,
} from '../lib/class-utils'
import { cakeCopy, getClassPageCopy, type Language } from '../lib/i18n'
import { createClassReservation, listClassBookedSlots } from '../lib/repository'
import type {
  ClassCoursePlan,
  ClassExtensionMinutes,
  ClassPartySize,
  ClassReservation,
  ClassType,
} from '../lib/types'
import {
  formatCurrency,
  generateRequestId,
  isValidPhone,
  normalizePhone,
} from '../lib/utils'

export function ClassReservePage({ navigate, onComplete, language, setLanguage, cartItemCount }: {
  navigate: (page: Page) => void
  onComplete: (reservation: ClassReservation) => void
  language: Language
  setLanguage: (language: Language) => void
  cartItemCount: number
}) {
  const nextCampaignDate = getNextSpringClassDate()
  const copy = getClassPageCopy(language)
  const campaignCopy = getSpringClassCampaignCopy(language)
  const campaignMonth = SPRING_CLASS_CAMPAIGN_2026.allowedDates[0].slice(0, 7)
  const campaignLastDate = SPRING_CLASS_CAMPAIGN_2026.allowedDates.at(-1) || SPRING_CLASS_CAMPAIGN_2026.visibleThrough
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
  }>(() => ({
    classDate: nextCampaignDate || '',
    classTime: CLASS_SESSION_TIMES[0],
    coursePlan: 'basic',
    extensionMinutes: 0,
    advancedClassDate: nextCampaignDate || '',
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
  }))
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
    if (!form.parentName.trim() || !form.childName.trim()) return setError(copy.reserve.errors.names)
    if (!isClassSchoolYearAllowed(form.coursePlan, form.schoolYear)) return setError(form.coursePlan === 'basic' ? copy.reserve.errors.basicSchoolYear : copy.reserve.errors.advancedSchoolYear)
    if (!isValidPhone(phone)) return setError(copy.reserve.errors.phone(cakeCopy(language).phoneHelp))
    if (!form.parentEmail.includes('@')) return setError(copy.reserve.errors.email)
    if (!isSpringClassBookingDateAllowed(form.classDate)) return setError(copy.reserve.errors.basicDate)
    if (selectedDateBooked) return setError(copy.reserve.dateUnavailable)
    if (!availableSessionTimes.includes(form.classTime as (typeof CLASS_SESSION_TIMES)[number])) return setError(copy.reserve.errors.classTime)
    if (form.coursePlan === 'basic-advanced-package') {
      if (!isSpringClassBookingDateAllowed(form.advancedClassDate)) return setError(copy.reserve.errors.advancedDate)
      if (advancedSelectedUnavailable || (form.advancedClassDate === form.classDate && form.advancedClassTime === form.classTime)) return setError(copy.reserve.errors.advancedTime)
    }
    if (partySize === 2 && (!form.secondChildName.trim() || !isClassSchoolYearAllowed('basic', form.secondChildSchoolYear))) return setError(copy.reserve.errors.secondChild)
    if (!form.emergencyContact.trim() || !form.pickupPerson.trim()) return setError(copy.reserve.errors.safety)
    if (!form.parentConsent || !form.cancellationAgreement || !form.privacyConsent) return setError(copy.reserve.errors.agreements)
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
        setError(copy.reserve.errors.unavailable)
      } else {
        setError(copy.reserve.errors.submit)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <SiteHeader navigate={navigate} language={language} setLanguage={setLanguage} cartItemCount={cartItemCount} />
      <main className="class-reserve-page">
        {!nextCampaignDate ? (
          <section className="class-reserve-form class-campaign-closed" aria-labelledby="spring-class-closed-title">
            <button className="class-back-button" type="button" onClick={() => navigate('classes')}>
              <ArrowLeft size={14} /> {copy.reserve.backToClasses}
            </button>
            <h1 id="spring-class-closed-title">{campaignCopy.closed}</h1>
          </section>
        ) : (
        <form className="class-reserve-form" onSubmit={submitClassReservation}>
          <label className="website-field" aria-hidden="true">
            {copy.reserve.honeypot}
            <input name="website" value={form.website} onChange={(event) => setForm({ ...form, website: event.target.value })} tabIndex={-1} autoComplete="off" />
          </label>
          <header className="class-reserve-title-block">
            <button className="class-back-button" type="button" onClick={() => navigate('classes')}>
              <ArrowLeft size={14} /> {copy.reserve.backToClasses}
            </button>
            <h1>{copy.reserve.title}</h1>
            <p>{copy.reserve.intro}</p>
          </header>

          <section className="class-form-section" aria-labelledby="course-plan-title">
            <h2 id="course-plan-title">{copy.reserve.planTitle}</h2>
            <div className="class-booking-grid">
              {(['basic', 'advanced', 'basic-advanced-package'] as const).map((coursePlan) => (
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
                  <span>{copy.reserve.coursePlans[coursePlan].label}</span>
                  <strong>{copy.reserve.coursePlans[coursePlan].detail}</strong>
                </label>
              ))}
            </div>
          </section>

          {form.coursePlan !== 'advanced' && (
            <section className="class-form-section" aria-labelledby="course-type-title">
              <h2 id="course-type-title">{copy.reserve.basicClassTitle}</h2>
              <div className="class-booking-grid class-two-option-grid">
                {(['school-holiday-private-cake-class', 'cupcake-chocolate-class'] as const).map((classType) => (
                  <label className="class-option-card" key={classType}>
                    <input type="radio" name="classType" checked={form.classType === classType} onChange={() => setForm({ ...form, classType })} />
                    <span>{copy.reserve.classTypes[classType].label}</span>
                    <strong>{copy.reserve.classTypes[classType].detail}</strong>
                  </label>
                ))}
              </div>
            </section>
          )}

          <section className="class-form-section" aria-labelledby="school-group-title">
            <h2 id="school-group-title">{copy.reserve.schoolGroupTitle}</h2>
            {form.coursePlan === 'basic' ? (
              <>
                <p>{copy.reserve.basicSchoolGroup}</p>
                <div className="class-booking-grid class-two-option-grid">
                  <label className="class-option-card">
                    <input
                      type="radio"
                      name="classSchoolGroup"
                      checked={selectedAgeGroup === 'kindy-year-2' || selectedAgeGroup === 'year-2'}
                      onChange={() => setForm({ ...form, schoolYear: ['Kindy', 'Year 1', 'Year 2'].includes(form.schoolYear) ? form.schoolYear : 'Kindy' })}
                    />
                    <span>{copy.reserve.youngerGroup}</span>
                    <strong>{copy.reserve.youngerDetail}</strong>
                  </label>
                  <label className="class-option-card">
                    <input
                      type="radio"
                      name="classSchoolGroup"
                      checked={selectedAgeGroup === 'year-3-6'}
                      onChange={() => setForm({ ...form, schoolYear: ['Year 3', 'Year 4', 'Year 5', 'Year 6'].includes(form.schoolYear) ? form.schoolYear : 'Year 3' })}
                    />
                    <span>{copy.reserve.olderGroup}</span>
                    <strong>{copy.reserve.olderDetail}</strong>
                  </label>
                </div>
              </>
            ) : (
              <p>{copy.reserve.advancedSchoolGroup}</p>
            )}
          </section>

          <section className="class-form-section" aria-labelledby="children-count-title">
            <h2 id="children-count-title">{copy.reserve.childrenTitle}</h2>
            {oneChildOnly ? <p>{copy.reserve.oneChildOnly}</p> : (
              <div className="class-booking-grid class-two-option-grid">
                {([1, 2] as const).map((nextPartySize) => (
                  <label className="class-option-card" key={nextPartySize}>
                    <input type="radio" name="classPartySize" checked={form.partySize === nextPartySize} onChange={() => setForm({ ...form, partySize: nextPartySize })} />
                    <span>{nextPartySize === 1 ? copy.reserve.oneChildLabel : copy.reserve.twoChildrenLabel}</span>
                    <strong>{nextPartySize === 1 ? copy.reserve.oneChildDetail : copy.reserve.twoChildrenDetail}</strong>
                  </label>
                ))}
              </div>
            )}
          </section>

          <section className="class-form-section class-form-section-tight" aria-labelledby="session-detail-title">
            <h2 id="session-detail-title">{copy.reserve.sessionTitle(form.coursePlan === 'advanced' ? copy.reserve.coursePlans.advanced.label : copy.reserve.coursePlans.basic.label, getClassDurationMinutes(form.coursePlan === 'advanced' ? 'advanced' : 'basic', form.extensionMinutes))}</h2>
            <div className="class-field">
              <span>{copy.reserve.preferredDate}</span>
              <WeekendDatePicker
                label={copy.reserve.preferredDate}
                locale={language === 'ko' ? 'ko-KR' : 'en-AU'}
                value={form.classDate}
                minDate={today}
                initialVisibleMonth={campaignMonth}
                maxDate={campaignLastDate}
                availabilityNote={`${campaignCopy.dates.join(' · ')} · ${campaignCopy.sessions}`}
                isDateDisabled={(date) => !isSpringClassBookingDateAllowed(date) || isClassDateBooked(date, bookedClassSlots)}
                onChange={(nextDate) => {
                  const nextAvailableTimes = getAvailableClassSessionTimes(nextDate, bookedClassSlots)
                  setForm({ ...form, classDate: nextDate, classTime: nextAvailableTimes[0] || CLASS_SESSION_TIMES[0] })
                }}
              />
            </div>
            <fieldset className="class-time-fieldset">
              <legend>{copy.reserve.preferredTime}</legend>
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
                  <p className="class-availability-note unavailable">{copy.reserve.dateUnavailable}</p>
                )}
              </div>
              {availabilityLoaded && availabilityError && <p className="class-availability-note unavailable">{copy.reserve.availabilityLoadError}</p>}
              {availabilityLoaded && !availabilityError && !selectedDateBooked && <p className="class-availability-note">{copy.reserve.available(availableSessionTimes.join(' / '))}</p>}
            </fieldset>
            <p className="field-help">{campaignCopy.calloutDates} · {campaignCopy.sessions}</p>
            <label className="class-check-row">
              <input type="checkbox" checked={form.extensionMinutes === 30} onChange={(event) => setForm({ ...form, extensionMinutes: event.target.checked ? 30 : 0 })} />
              <span>{copy.reserve.addMinutes}</span>
            </label>
            {form.extensionMinutes === 30 && <p className="class-availability-note warning">{language === 'ko' ? copy.reserve.extensionWarning : CLASS_EXTENSION_WARNING}</p>}

            {form.coursePlan === 'basic-advanced-package' && (
              <div className="class-package-session">
                <h3>{copy.reserve.advancedSessionTitle(getClassDurationMinutes('advanced', form.advancedExtensionMinutes))}</h3>
                <div className="class-field">
                  <span>{copy.reserve.advancedDate}</span>
                  <WeekendDatePicker
                    label={copy.reserve.advancedDate}
                    locale={language === 'ko' ? 'ko-KR' : 'en-AU'}
                    minDate={today}
                    value={form.advancedClassDate}
                    initialVisibleMonth={campaignMonth}
                    maxDate={campaignLastDate}
                    availabilityNote={`${campaignCopy.dates.join(' · ')} · ${campaignCopy.sessions}`}
                    isDateDisabled={(date) => !isSpringClassBookingDateAllowed(date) || isClassDateBooked(date, bookedClassSlots)}
                    onChange={(advancedClassDate) => {
                    const times = getAvailableClassSessionTimes(advancedClassDate, bookedClassSlots)
                    setForm({ ...form, advancedClassDate, advancedClassTime: times[0] || CLASS_SESSION_TIMES[0] })
                  }} />
                </div>
                <fieldset className="class-time-fieldset">
                  <legend>{copy.reserve.advancedTime}</legend>
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
                  <span>{copy.reserve.addAdvancedMinutes}</span>
                </label>
                {form.advancedExtensionMinutes === 30 && <p className="class-availability-note warning">{language === 'ko' ? copy.reserve.extensionWarning : CLASS_EXTENSION_WARNING}</p>}
              </div>
            )}
          </section>

          <section className="class-form-section" aria-labelledby="guardian-detail-title">
            <h2 id="guardian-detail-title">6. {copy.reserve.parentDetails}</h2>
            <label className="class-field">
              <span>{copy.reserve.fullName}</span>
              <input value={form.parentName} onChange={(event) => setForm({ ...form, parentName: event.target.value })} placeholder={copy.reserve.fullNamePlaceholder} />
            </label>
            <label className="class-field">
              <span>{copy.reserve.emailAddress}</span>
              <input type="email" value={form.parentEmail} onChange={(event) => setForm({ ...form, parentEmail: event.target.value })} placeholder="name@email.com" />
            </label>
            <label className="class-field">
              <span>{copy.reserve.mobileNumber}</span>
              <input inputMode="tel" value={form.parentPhone} onChange={(event) => setForm({ ...form, parentPhone: event.target.value })} placeholder="0412 345 678" />
            </label>
          </section>

          <section className="class-form-section" aria-labelledby="child-detail-title">
            <h2 id="child-detail-title">7. {copy.reserve.childDetails}</h2>
            <label className="class-field">
              <span>{copy.reserve.childOneName}</span>
              <input value={form.childName} onChange={(event) => setForm({ ...form, childName: event.target.value })} placeholder="Leo" />
            </label>
            <div className="class-split-row">
              <label className="class-field">
                <span>{copy.reserve.childOneAge}</span>
                <input type="number" min="3" max="18" value={form.childAge} onChange={(event) => setForm({ ...form, childAge: Number(event.target.value) })} />
              </label>
              <label className="class-field">
                <span>{copy.reserve.childOneSchoolYear}</span>
                <select value={form.schoolYear} onChange={(event) => setForm({ ...form, schoolYear: event.target.value })}>
                  {schoolYears.map((year) => <option value={year} key={year}>{year}</option>)}
                </select>
              </label>
            </div>
            {partySize === 2 && (
              <>
                <label className="class-field">
                  <span>{copy.reserve.childTwoName}</span>
                  <input value={form.secondChildName} onChange={(event) => setForm({ ...form, secondChildName: event.target.value })} placeholder="Chloe" />
                </label>
                <div className="class-split-row">
                  <label className="class-field">
                    <span>{copy.reserve.childTwoAge}</span>
                    <input type="number" min="3" max="18" value={form.secondChildAge} onChange={(event) => setForm({ ...form, secondChildAge: Number(event.target.value) })} />
                  </label>
                  <label className="class-field">
                    <span>{copy.reserve.childTwoSchoolYear}</span>
                    <select value={form.secondChildSchoolYear} onChange={(event) => setForm({ ...form, secondChildSchoolYear: event.target.value })}>
                      <option value="">{copy.reserve.chooseYear}</option>
                      {getClassSchoolYears('basic').map((year) => <option value={year} key={year}>{year}</option>)}
                    </select>
                  </label>
                </div>
              </>
            )}
          </section>

          <section className="class-form-section" aria-labelledby="safety-title">
            <h2 id="safety-title">8. {copy.reserve.safetyTitle}</h2>
            <label className="class-field">
              <span>{copy.reserve.allergyNotes}</span>
              <textarea value={form.allergyNote} onChange={(event) => setForm({ ...form, allergyNote: event.target.value })} placeholder={copy.reserve.allergyPlaceholder} />
            </label>
            <div className="class-split-row">
              <label className="class-field">
                <span>{copy.reserve.emergencyContact}</span>
                <input value={form.emergencyContact} onChange={(event) => setForm({ ...form, emergencyContact: event.target.value })} placeholder={copy.reserve.emergencyPlaceholder} />
              </label>
              <label className="class-field">
                <span>{copy.reserve.pickupPerson}</span>
                <input value={form.pickupPerson} onChange={(event) => setForm({ ...form, pickupPerson: event.target.value })} placeholder={copy.reserve.pickupPlaceholder} />
              </label>
            </div>
          </section>

          <section className="class-form-section" aria-labelledby="consent-title">
            <h2 id="consent-title">9. {copy.reserve.consentTitle}</h2>
            <label className="class-check-row">
              <input type="checkbox" checked={form.parentConsent} onChange={(event) => setForm({ ...form, parentConsent: event.target.checked })} />
              <span>{copy.reserve.parentConsent}</span>
            </label>
            <label className="class-check-row">
              <input type="checkbox" checked={form.cancellationAgreement} onChange={(event) => setForm({ ...form, cancellationAgreement: event.target.checked })} />
              <span>{copy.reserve.bookingConsent}</span>
            </label>
            <label className="class-check-row">
              <input type="checkbox" checked={form.privacyConsent} onChange={(event) => setForm({ ...form, privacyConsent: event.target.checked })} />
              <span>{copy.reserve.privacyConsent}</span>
            </label>
            <fieldset className="class-photo-consent">
              <legend>{copy.reserve.photoConsent}</legend>
              <div className="class-photo-options">
                <label>
                  <input type="radio" name="photoConsent" checked={form.photoConsent} onChange={() => setForm({ ...form, photoConsent: true })} />
                  <span>{copy.reserve.photoYes}</span>
                </label>
                <label>
                  <input type="radio" name="photoConsent" checked={!form.photoConsent} onChange={() => setForm({ ...form, photoConsent: false })} />
                  <span>{copy.reserve.photoNo}</span>
                </label>
              </div>
            </fieldset>
          </section>

          <aside className="class-reserve-summary" aria-label={copy.reserve.summaryLabel}>
            <dl>
              <div><dt>{copy.reserve.summary.plan}</dt><dd>{copy.reserve.coursePlans[form.coursePlan].label}</dd></div>
              <div><dt>{copy.reserve.summary.course}</dt><dd>{copy.reserve.classTypes[form.coursePlan === 'advanced' ? 'advanced-2-tier-cake-class' : form.classType].label}</dd></div>
              <div><dt>{copy.reserve.summary.schoolYear}</dt><dd>{form.schoolYear}</dd></div>
              <div><dt>{copy.reserve.summary.children}</dt><dd>{partySize}</dd></div>
              <div><dt>{copy.reserve.summary.firstSession}</dt><dd>{copy.reserve.sessionSummary(form.classDate, form.classTime, getClassDurationMinutes(form.coursePlan === 'advanced' ? 'advanced' : 'basic', form.extensionMinutes))}</dd></div>
              {form.coursePlan === 'basic-advanced-package' && <div><dt>{copy.reserve.summary.advancedSession}</dt><dd>{copy.reserve.sessionSummary(form.advancedClassDate, form.advancedClassTime, getClassDurationMinutes('advanced', form.advancedExtensionMinutes))}</dd></div>}
              <div><dt>{copy.reserve.summary.subtotal}</dt><dd>{formatCurrency(pricing.subtotalCents / 100)}</dd></div>
              {pricing.discountCents > 0 && <div><dt>{copy.reserve.summary.packageDiscount}</dt><dd>{pricing.discountPercent}% · -{formatCurrency(pricing.discountCents / 100)}</dd></div>}
              <div><dt>{copy.reserve.summary.total}</dt><dd>{formatCurrency(price)}</dd></div>
              <div><dt>{copy.reserve.summary.payment}</dt><dd>{copy.reserve.summary.fullPayment}</dd></div>
            </dl>
            <BankAccountBox settings={CLASS_PAYMENT_SETTINGS} totalPrice={price} language={language} />
            <p className="class-submit-note">{copy.reserve.paymentNote}</p>
          </aside>

          {error && <p className="error-text class-error-text">{error}</p>}
          <button className="class-submit-button" type="submit" disabled={submitting || selectedDateBooked}>{submitting ? copy.reserve.submitting : selectedDateBooked ? copy.reserve.selectedDateUnavailable : copy.reserve.submit}</button>
          <p className="class-submit-note">{copy.reserve.submitNote}</p>
        </form>
        )}
      </main>
    </>
  )
}
