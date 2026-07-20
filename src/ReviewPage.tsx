import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent, type MouseEvent } from 'react'
import { appwriteConfig, functions } from './lib/appwrite'
import { loadReviewInvite, removeReviewPhoto, submitCustomerReview, uploadReviewPhoto } from './lib/review-repository'
import { compressReviewPhoto, createPreviewUrlController, ReviewPhotoError } from './lib/review-photo'
import {
  REVIEW_COPY,
  copyReviewCoupon,
  createReviewGenerationController,
  finishReviewOperation,
  extractReviewToken,
  formatCouponExpiry,
  formatExperienceDate,
  getDefaultReviewConsentState,
  getReviewDocumentLanguage,
  getReviewSourceLabel,
  getStarAriaLabel,
  isReviewDemoMode,
  tryBeginReviewOperation,
  type ReviewGenerationBinding,
  type ReviewInviteContext,
  type ReviewLanguage,
  type ReviewSubmissionResult,
} from './lib/review-page'

type LoadState =
  | { kind: 'loading' }
  | { kind: 'valid'; context: ReviewInviteContext; binding: ReviewGenerationBinding }
  | { kind: 'invalid' }
  | { kind: 'error' }

type PhotoStatus = 'idle' | 'selecting' | 'compressing' | 'uploading' | 'attached' | 'removing' | 'error'

const demoMode = import.meta.env.DEV && isReviewDemoMode(import.meta.env.VITE_REVIEW_DEMO_MODE)

export default function ReviewPage({ onOrderCake }: { onOrderCake: (couponCode: string, rewardPercent: 5 | 10) => void }) {
  const [generationController] = useState(() => createReviewGenerationController())
  const [language, setLanguage] = useState<ReviewLanguage>('en')
  const [loadState, setLoadState] = useState<LoadState>({ kind: 'loading' })
  const initialConsents = getDefaultReviewConsentState(false)
  const [rating, setRating] = useState(0)
  const [body, setBody] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [publishConsent, setPublishConsent] = useState(initialConsents.publishConsent)
  const [photoPublishConsent, setPhotoPublishConsent] = useState(initialConsents.photoPublishConsent)
  const [photoStatus, setPhotoStatus] = useState<PhotoStatus>('idle')
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null)
  const [photoErrorCode, setPhotoErrorCode] = useState<'invalid' | 'too-large' | 'dimensions-too-large' | 'request' | null>(null)
  const [previewController] = useState(() => createPreviewUrlController())
  const photoInputRef = useRef<HTMLInputElement | null>(null)
  const choosePhotoButtonRef = useRef<HTMLButtonElement | null>(null)
  const photoStatusRef = useRef<HTMLParagraphElement | null>(null)
  const successHeadingRef = useRef<HTMLHeadingElement | null>(null)
  const photoFocusTargetRef = useRef<'status' | 'choose' | null>(null)
  const submittingRef = useRef(false)
  const photoOperationRef = useRef(false)
  const [website, setWebsite] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<'generic' | 'uncertain' | null>(null)
  const [success, setSuccess] = useState<ReviewSubmissionResult | null>(null)
  const successBindingRef = useRef<ReviewGenerationBinding | null>(null)
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState(false)
  const copyTimerRef = useRef<number | null>(null)
  const copy = REVIEW_COPY[language]

  const clearCopyTimer = useCallback(() => {
    if (copyTimerRef.current !== null) {
      window.clearTimeout(copyTimerRef.current)
      copyTimerRef.current = null
    }
  }, [])

  const resetReviewState = useCallback(() => {
    clearCopyTimer()
    setRating(0)
    setBody('')
    setDisplayName('')
    const consents = getDefaultReviewConsentState(false)
    setPublishConsent(consents.publishConsent)
    setPhotoPublishConsent(consents.photoPublishConsent)
    setPhotoStatus('idle')
    setPhotoErrorCode(null)
    previewController.clear()
    setPhotoPreviewUrl(null)
    if (photoInputRef.current) photoInputRef.current.value = ''
    setWebsite('')
    submittingRef.current = false
    photoOperationRef.current = false
    photoFocusTargetRef.current = null
    setSubmitting(false)
    setSubmitError(null)
    setSuccess(null)
    successBindingRef.current = null
    setCopied(false)
    setCopyError(false)
  }, [clearCopyTimer, previewController])

  const loadCurrentToken = useCallback(async () => {
    resetReviewState()
    const token = extractReviewToken(window.location.hash)
    if (!token) {
      generationController.invalidate()
      setLoadState({ kind: 'invalid' })
      return
    }

    const binding = generationController.begin(token)
    setLoadState({ kind: 'loading' })
    if (demoMode) {
      const { reviewDemoFixture } = await import('./lib/review-page-demo')
      const context = reviewDemoFixture()
      generationController.commit(binding, () => {
        const consents = getDefaultReviewConsentState(context.hasPhoto)
        setPublishConsent(consents.publishConsent)
        setPhotoPublishConsent(consents.photoPublishConsent)
        setLoadState({ kind: 'valid', context, binding })
      })
      return
    }

    try {
      const context = await loadReviewInvite(functions, appwriteConfig.reviewApiFunctionId, binding.token)
      generationController.commit(binding, () => {
        const consents = getDefaultReviewConsentState(context.hasPhoto)
        setPublishConsent(consents.publishConsent)
        setPhotoPublishConsent(consents.photoPublishConsent)
        setLoadState({ kind: 'valid', context, binding })
      })
    } catch (error) {
      generationController.commit(binding, () => {
        const code = (error as { code?: unknown } | null)?.code
        setLoadState({ kind: code === 'REVIEW_INVITE_INVALID' || code === 'REVIEW_ALREADY_SUBMITTED' ? 'invalid' : 'error' })
      })
    }
  }, [generationController, resetReviewState])

  useEffect(() => {
    generationController.activate()
    let initialTimer: number | null = window.setTimeout(() => {
      initialTimer = null
      void loadCurrentToken()
    }, 0)
    const handleHashChange = () => {
      if (initialTimer !== null) {
        window.clearTimeout(initialTimer)
        initialTimer = null
      }
      void loadCurrentToken()
    }
    window.addEventListener('hashchange', handleHashChange)
    return () => {
      window.removeEventListener('hashchange', handleHashChange)
      if (initialTimer !== null) window.clearTimeout(initialTimer)
      clearCopyTimer()
      previewController.dispose()
      submittingRef.current = false
      photoOperationRef.current = false
      generationController.dispose()
    }
  }, [clearCopyTimer, generationController, loadCurrentToken, previewController])

  useEffect(() => {
    const previousLanguage = document.documentElement.lang
    return () => {
      document.documentElement.lang = previousLanguage
    }
  }, [])

  useEffect(() => {
    document.documentElement.lang = getReviewDocumentLanguage(language)
  }, [language])

  useEffect(() => {
    if (photoFocusTargetRef.current === 'status' && photoStatus === 'attached') {
      photoFocusTargetRef.current = null
      photoStatusRef.current?.focus()
    } else if (photoFocusTargetRef.current === 'choose' && photoStatus === 'idle') {
      photoFocusTargetRef.current = null
      choosePhotoButtonRef.current?.focus()
    }
  }, [photoStatus])

  useEffect(() => {
    if (success) successHeadingRef.current?.focus()
  }, [success])

  const processingPhoto = photoStatus === 'selecting' || photoStatus === 'compressing' || photoStatus === 'uploading' || photoStatus === 'removing'
  const hasPhoto = loadState.kind === 'valid' && loadState.context.hasPhoto

  function commitPhotoState(binding: ReviewGenerationBinding, attached: boolean) {
    generationController.commit(binding, () => {
      setLoadState((current) => current.kind === 'valid' && current.binding.generation === binding.generation
        ? { ...current, context: { ...current.context, hasPhoto: attached } }
        : current)
    })
  }

  async function selectPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || loadState.kind !== 'valid' || !tryBeginReviewOperation('photo', submittingRef, photoOperationRef)) return
    const binding = loadState.binding
    setPhotoStatus('selecting')
    setPhotoErrorCode(null)
    try {
      setPhotoStatus('compressing')
      const blob = await compressReviewPhoto(file)
      if (!generationController.isCurrent(binding)) return
      setPhotoStatus('uploading')
      if (!demoMode) await uploadReviewPhoto(functions, appwriteConfig.reviewApiFunctionId, binding.token, blob)
      if (!generationController.isCurrent(binding)) return
      const nextPreview = previewController.replace(blob)
      generationController.commit(binding, () => {
        setPhotoPreviewUrl(nextPreview)
        photoFocusTargetRef.current = 'status'
        setPhotoStatus('attached')
        setPhotoPublishConsent(getDefaultReviewConsentState(true).photoPublishConsent)
      })
      commitPhotoState(binding, true)
    } catch (error) {
      generationController.commit(binding, () => {
        setPhotoStatus('error')
        setPhotoErrorCode(error instanceof ReviewPhotoError
          ? (error.code === 'PHOTO_TOO_LARGE'
              ? 'too-large'
              : error.code === 'PHOTO_DIMENSIONS_TOO_LARGE' ? 'dimensions-too-large' : 'invalid')
          : 'request')
      })
    } finally {
      if (generationController.isCurrent(binding)) finishReviewOperation('photo', submittingRef, photoOperationRef)
    }
  }

  async function removePhoto() {
    if (loadState.kind !== 'valid' || !loadState.context.hasPhoto || !tryBeginReviewOperation('photo', submittingRef, photoOperationRef)) return
    const binding = loadState.binding
    setPhotoStatus('removing')
    setPhotoErrorCode(null)
    try {
      if (!demoMode) await removeReviewPhoto(functions, appwriteConfig.reviewApiFunctionId, binding.token)
      generationController.commit(binding, () => {
        commitPhotoState(binding, false)
        setPhotoPublishConsent(false)
        previewController.clear()
        setPhotoPreviewUrl(null)
        photoFocusTargetRef.current = 'choose'
        setPhotoStatus('idle')
      })
    } catch {
      generationController.commit(binding, () => {
        setPhotoStatus('error')
        setPhotoErrorCode('request')
      })
    } finally {
      if (generationController.isCurrent(binding)) finishReviewOperation('photo', submittingRef, photoOperationRef)
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (loadState.kind !== 'valid' || rating < 1 || !body.trim() || body.length > 2000) return
    const binding = loadState.binding
    if (!generationController.isCurrent(binding) || !tryBeginReviewOperation('submit', submittingRef, photoOperationRef)) return

    setSubmitting(true)
    setSubmitError(null)
    try {
      const result = demoMode
        ? (await import('./lib/review-page-demo')).reviewDemoSubmission(loadState.context.hasPhoto)
        : await submitCustomerReview(functions, appwriteConfig.reviewApiFunctionId, {
            token: loadState.binding.token,
            rating,
            body,
            displayName,
            publishConsent,
            photoPublishConsent: loadState.context.hasPhoto ? photoPublishConsent : false,
            website,
          })
      generationController.commit(binding, () => {
        successBindingRef.current = binding
        setSuccess(result)
      })
    } catch (error) {
      generationController.commit(binding, () => setSubmitError(
        (error as { code?: unknown } | null)?.code === 'REVIEW_SUBMISSION_UNCERTAIN' ? 'uncertain' : 'generic',
      ))
    } finally {
      generationController.commit(binding, () => {
        finishReviewOperation('submit', submittingRef, photoOperationRef)
        setSubmitting(false)
      })
    }
  }

  async function copyCoupon() {
    if (!success || loadState.kind !== 'valid') return
    const binding = loadState.binding
    clearCopyTimer()
    setCopied(false)
    setCopyError(false)
    const didCopy = await copyReviewCoupon(navigator.clipboard, success.couponCode)
    generationController.commit(binding, () => {
      if (!didCopy) {
        setCopied(false)
        setCopyError(true)
        return
      }
      setCopied(true)
      copyTimerRef.current = window.setTimeout(() => {
        generationController.commit(binding, () => setCopied(false))
        copyTimerRef.current = null
      }, 1800)
    })
  }

  function orderAgain(event: MouseEvent<HTMLAnchorElement>) {
    const binding = successBindingRef.current
    if (!success || !binding || !generationController.isCurrent(binding)) return
    event.preventDefault()
    onOrderCake(success.couponCode, success.rewardPercent)
  }

  return (
    <div className="review-page">
      <header className="review-header">
        <a href="/" className="review-wordmark" aria-label="Very Good Chocolate home">very good</a>
        <div className="review-header-actions">
          {demoMode && <span className="review-demo-badge">DEMO</span>}
          <button type="button" className="review-language" onClick={() => setLanguage(language === 'en' ? 'ko' : 'en')}>
            {copy.languageName}
          </button>
        </div>
      </header>

      <main className="review-main">
        {loadState.kind === 'loading' && <section className="review-state" aria-live="polite"><p>{copy.loading}</p></section>}

        {(loadState.kind === 'invalid' || loadState.kind === 'error') && (
          <section className="review-state" role="alert">
            <p className="review-kicker">VERY GOOD REVIEW</p>
            <h1>{loadState.kind === 'invalid' ? copy.invalidTitle : copy.genericError}</h1>
            {loadState.kind === 'invalid' && <p>{copy.invalidBody}</p>}
            <button type="button" className="review-primary" onClick={() => void loadCurrentToken()}>{copy.retry}</button>
            <a className="review-secondary" href="/">{copy.home}</a>
          </section>
        )}

        {loadState.kind === 'valid' && !success && (
          <form className="review-form" onSubmit={submit}>
            <div className="review-intro">
              <p className="review-kicker">{getReviewSourceLabel(loadState.context.sourceType, language)} · {formatExperienceDate(loadState.context.experienceDate, language)}</p>
              <h1>{copy.title}</h1>
              <p>{copy.intro}</p>
            </div>

            <fieldset className="review-rating">
              <legend>{copy.rating} <span aria-hidden="true">*</span></legend>
              <div className="review-stars">
                {[1, 2, 3, 4, 5].map((value) => (
                  <label key={value}>
                    <input type="radio" name="rating" value={value} checked={rating === value} onChange={() => setRating(value)} required aria-label={getStarAriaLabel(value, language)} />
                    <span aria-hidden="true">★</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="review-field">
              <span>{copy.body} *</span>
              <textarea required maxLength={2000} rows={7} value={body} onChange={(event) => setBody(event.target.value)} />
              <small><span>{copy.bodyHint}</span><strong aria-live="polite">{body.length}/2000</strong></small>
            </label>

            <label className="review-field">
              <span>{copy.displayName}</span>
              <input type="text" maxLength={50} value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
            </label>

            <label className="review-consent">
              <input type="checkbox" checked={publishConsent} onChange={(event) => setPublishConsent(event.target.checked)} />
              <span>{copy.publishConsent}</span>
            </label>

            <div className="review-honeypot" aria-hidden="true">
              <label>Website<input type="text" name="website" tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} /></label>
            </div>

            <section className="review-photo-card">
              <div className="review-photo-copy">
                <strong>{copy.photoTitle}</strong>
                <p>{copy.photoPrivate}</p>
                <p className="review-photo-reward"><strong>{hasPhoto ? copy.rewardTen : copy.rewardFive}</strong></p>
              </div>
              {photoPreviewUrl && <img className="review-photo-preview" src={photoPreviewUrl} alt={copy.photoAttached} />}
              {hasPhoto && !photoPreviewUrl && <p className="review-photo-attached">✓ {copy.photoAttached}</p>}
              <input
                ref={photoInputRef}
                className="review-photo-input"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                tabIndex={-1}
                aria-hidden="true"
                disabled={submitting || processingPhoto}
                onChange={(event) => void selectPhoto(event)}
              />
              <div className="review-photo-actions">
                <button ref={choosePhotoButtonRef} type="button" disabled={submitting || processingPhoto} onClick={() => photoInputRef.current?.click()}>
                  {hasPhoto ? copy.photoReplace : copy.photoChoose}
                </button>
                {hasPhoto && <button type="button" disabled={submitting || processingPhoto} onClick={() => void removePhoto()}>{copy.photoRemove}</button>}
              </div>
              <p ref={photoStatusRef} className="review-photo-status" tabIndex={-1} aria-live="polite" role={photoErrorCode ? 'alert' : 'status'}>
                {photoStatus === 'compressing' && copy.photoCompressing}
                {photoStatus === 'uploading' && copy.photoUploading}
                {photoStatus === 'removing' && copy.photoRemoving}
                {photoStatus === 'attached' && copy.photoAttached}
                {photoErrorCode && <strong className="review-photo-failure-title">{hasPhoto ? copy.photoUpdateFailed : copy.photoUploadFailed}</strong>}{' '}
                {photoErrorCode === 'invalid' && copy.photoInvalid}
                {photoErrorCode === 'too-large' && copy.photoTooLarge}
                {photoErrorCode === 'dimensions-too-large' && copy.photoDimensionsTooLarge}
                {photoErrorCode === 'request' && copy.photoError}
              </p>
            </section>

            {hasPhoto && (
              <label className="review-consent review-photo-consent">
                <input type="checkbox" checked={photoPublishConsent} onChange={(event) => setPhotoPublishConsent(event.target.checked)} />
                <span>{copy.photoPublishConsent}</span>
              </label>
            )}

            <aside className="review-disclosure">
              <strong>{copy.disclosure}</strong>
              <p>{copy.incentivisedNotice}</p>
            </aside>

            {submitError && <p className="review-error" role="alert">{submitError === 'uncertain' ? copy.submissionUncertain : copy.genericError}</p>}
            <button className="review-primary review-submit" type="submit" disabled={submitting || processingPhoto || rating < 1 || !body.trim()}>
              {submitting ? copy.submitting : copy.submit}
            </button>
          </form>
        )}

        {success && (
          <section className="review-ticket" aria-live="polite">
            <p className="review-kicker">VERY GOOD · THANK YOU</p>
            <h1 ref={successHeadingRef} tabIndex={-1}>{copy.successTitle}</h1>
            <div className="review-ticket-code">
              <span>{copy.reward} · {success.rewardPercent}%</span>
              <strong>{success.couponCode}</strong>
              <button type="button" onClick={() => void copyCoupon()}>{copied ? copy.copied : copy.copy}</button>
            </div>
            {copyError && <p className="review-error" role="alert">{copy.copyError}</p>}
            <p>{copy.expires}: {formatCouponExpiry(success.couponExpiresAt, language)}</p>
            <div className="review-ticket-actions">
              <a className="review-primary" href="/reserve" onClick={orderAgain}>{copy.order}</a>
              <a className="review-secondary" href="/">{copy.home}</a>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
