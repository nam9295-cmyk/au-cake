import { useState } from 'react'
import { MOCHI_FLAVOURS, priceRenewalOrder, type MochiCounts, type RenewalSelection } from '../../appwrite-functions/reservation-api/src/au-renewal.js'
import { useAuLanguage } from '../lib/au-language'
import { splitMochiSingles } from '../lib/renewal-cart'
import { useCart } from '../CartProvider'

const emptyCounts = () => Object.fromEntries(MOCHI_FLAVOURS.map(f => [f.id, 0])) as MochiCounts
const total = (counts: MochiCounts) => Object.values(counts).reduce((a, b) => a + b, 0)
const money = (cents: number) => `AUD ${(cents / 100).toFixed(2)}`
function Counter({ label, value, onChange, max = Number.MAX_SAFE_INTEGER, min = 0 }: {
  label: string; value: number; onChange: (value: number) => void; max?: number; min?: number
}) {
  const { t } = useAuLanguage()
  return <div className="mochi-counter">
    <button type="button" aria-label={`${label} ${t('decrease', '줄이기')}`} disabled={value <= min} onClick={() => onChange(value - 1)}>−</button>
    <input type="number" aria-label={label} inputMode="numeric" step={1} min={min} max={max} value={value} onChange={e => {
      const n = Number(e.target.value)
      if (Number.isSafeInteger(n) && n >= min && n <= max) onChange(n)
    }} />
    <button type="button" aria-label={`${label} ${t('increase', '늘리기')}`} disabled={value >= max} onClick={() => onChange(value + 1)}>+</button>
  </div>
}
function FlavourCounts({ counts, onChange, box = false, available, prefix = '' }: {
  counts: MochiCounts; onChange: (counts: MochiCounts) => void; box?: boolean; available?: MochiCounts; prefix?: string
}) {
  const { language, t } = useAuLanguage()
  const selected = total(counts)
  return <div className="mochi-flavours">{MOCHI_FLAVOURS.map(f => {
    const name = language === 'ko' ? f.ko : f.en
    const max = Math.min(available?.[f.id] ?? Number.MAX_SAFE_INTEGER, box ? counts[f.id] + 4 - selected : Number.MAX_SAFE_INTEGER)
    return <div className="mochi-flavour" key={f.id}>
      <div>{name}<div>{money(f.priceCents)}</div></div>
      <Counter label={`${prefix}${name} ${t('quantity', '수량')}`} value={counts[f.id]} max={max} onChange={n => onChange({ ...counts, [f.id]: n })} />
    </div>
  })}</div>
}
export function MochiReselectionNotice() {
  const cart = useCart(), { t } = useAuLanguage()
  if (!cart.mochiReselectionRequired) return null
  return <aside className="mochi-reselection" role="status">
    <p>{t('Mochi now has six flavours and new gift-box choices. Your previous mochi selection was saved separately; please select it again. Other items in your bag are unchanged.', '모찌가 6가지 맛과 새로운 선물박스 구성으로 변경되었습니다. 이전 모찌 선택은 별도 보관했으니 다시 선택해주세요. 다른 장바구니 상품은 그대로입니다.')}</p>
    <a href="/chocolates/chocolate-mochi">{t('Choose mochi again', '모찌 다시 선택하기')}</a>{' '}
    <button type="button" onClick={cart.acknowledgeMochiReselection}>{t('Got it', '확인했어요')}</button>
  </aside>
}
export function MochiBuilder({ initial, onSave, onCancel, disabled = false }: {
  initial?: RenewalSelection; onSave: (lines: RenewalSelection[]) => void; onCancel?: () => void; disabled?: boolean
}) {
  const { t, language } = useAuLanguage()
  const [lineId] = useState(() => initial?.lineId || crypto.randomUUID())
  const [mode, setMode] = useState(initial?.mode || 'gift-four')
  const [giftCounts, setGiftCounts] = useState(initial?.mode === 'gift-four' ? initial.flavourCounts! : emptyCounts())
  const [singleCounts, setSingleCounts] = useState(initial?.mode === 'singles' ? initial.flavourCounts! : emptyCounts())
  const [quantity, setQuantity] = useState(initial?.quantity || 1)
  const [packaging, setPackaging] = useState(initial?.individualPackaging || false)
  const [converted, setConverted] = useState<RenewalSelection[]>([])
  const [allocation, setAllocation] = useState<MochiCounts | null>(null)
  const [error, setError] = useState(''), [added, setAdded] = useState(false)
  const singles: RenewalSelection = { lineId, offerId: 'mochi', mode: 'singles', flavourCounts: singleCounts, quantity: 1, individualPackaging: packaging }
  const lines: RenewalSelection[] = mode === 'gift-four'
    ? [{ lineId, offerId: 'mochi', mode, flavourCounts: giftCounts, quantity, individualPackaging: false }]
    : [...converted, ...(total(singleCounts) > 0 ? [singles] : [])]
  let quote: ReturnType<typeof priceRenewalOrder> | null = null
  try { quote = priceRenewalOrder(lines) } catch { /* incomplete or unsafe quantity cannot be added */ }
  const composition = (counts: MochiCounts) => MOCHI_FLAVOURS.filter(f => counts[f.id]).map(f => `${language === 'ko' ? f.ko : f.en} ${counts[f.id]}`).join(' · ')
  function save() {
    try {
      priceRenewalOrder(lines)
      onSave(lines)
      setAdded(true); setError('')
    } catch { setError(t('Please check your quantities and selections.', '수량과 구성을 확인해주세요.')) }
  }
  return <fieldset className="mochi-builder" disabled={disabled}>
    <legend>{t('Choose your mochi', '모찌 구성 선택')}</legend>
    <div className="mochi-modes" role="group" aria-label={t('Order method', '구매 방식')}>
      <button type="button" aria-pressed={mode === 'gift-four'} onClick={() => { setMode('gift-four'); setAdded(false) }}>{t('4-piece gift box', '4구 선물박스')}</button>
      <button type="button" aria-pressed={mode === 'singles'} onClick={() => { setMode('singles'); setAdded(false) }}>{t('Singles', '단품 구매')}</button>
    </div>
    {mode === 'gift-four' ? <>
      <p>{t('Choose any four, including repeated flavours. Pay the sum of your selections; gift-box packaging is free.', '같은 맛도 중복해서 4개를 골라주세요. 선택한 단품 가격을 합산하며 선물박스 포장은 무료입니다.')}</p>
      <FlavourCounts counts={giftCounts} box onChange={counts => { setGiftCounts(counts); setAdded(false) }} />
      <p role="status">{total(giftCounts)} / 4 {t('selected', '개 선택')}</p>
      <div className="mochi-flavour"><span>{t('Identical boxes', '같은 구성 박스 수')}</span><Counter label={t('Boxes', '박스 수')} min={1} value={quantity} onChange={setQuantity} /></div>
      <p>{t('Gift-box packaging', '선물박스 포장비')} · AUD 0.00</p>
    </> : <>
      <FlavourCounts counts={singleCounts} onChange={counts => { setSingleCounts(counts); setAllocation(null); setAdded(false) }} />
      <p>{total(singleCounts)} {t('singles', '개 단품')}</p>
      <label className="renewal-check"><input type="checkbox" checked={packaging} onChange={e => setPackaging(e.target.checked)} />{t('Individual packaging · AUD 0.50 per single', '개별포장 · 단품 개당 AUD 0.50')}</label>
      {converted.map((box, i) => <p key={box.lineId}>{t('Gift box', '선물박스')} {i + 1}: {composition(box.flavourCounts!)} · {t('4 pieces / packaging free', '4개 / 박스 포장 무료')}</p>)}
      {converted.length > 0 && <button type="button" onClick={() => {
        const restored = { ...singleCounts }
        for (const box of converted) for (const f of MOCHI_FLAVOURS) restored[f.id] += box.flavourCounts![f.id]
        setSingleCounts(restored); setConverted([]); setAllocation(null)
      }}>{t('Return these boxes to singles', '이 박스들을 단품으로 되돌리기')}</button>}
      {total(singleCounts) >= 4 && !allocation && <>
        <p>{t('You can put four of these singles into a free gift box. Choose exactly which four; nothing changes until you confirm.', '이 단품 중 4개를 무료 선물박스에 담을 수 있습니다. 원하는 4개를 직접 고르고 확인해주세요.')}</p>
        <button type="button" onClick={() => setAllocation(emptyCounts())}>{t('Choose four for a gift box', '박스에 담을 4개 고르기')}</button>
      </>}
      {allocation && <fieldset>
        <legend>{t('Choose this box from your singles', '단품에서 이 박스 구성 선택')}</legend>
        <FlavourCounts counts={allocation} box available={singleCounts} prefix={t('Box: ', '박스: ')} onChange={setAllocation} />
        <p>{total(allocation)} / 4 · {t('The selected pieces will move out of singles.', '선택한 수량만 단품에서 이동합니다.')}</p>
        {packaging && <p>{t('Individual packaging for these four is removed: save AUD 2.00.', '이 4개의 개별포장비 AUD 2.00이 제외됩니다.')}</p>}
        <button type="button" disabled={total(allocation) !== 4} onClick={() => {
          try {
            const split = splitMochiSingles(singles, allocation, crypto.randomUUID())
            setConverted([...converted, split.box]); setSingleCounts(split.remaining?.flavourCounts || emptyCounts()); setAllocation(null); setAdded(false); setError('')
          } catch { setError(t('Please check the box selection.', '박스 구성을 확인해주세요.')) }
        }}>{t('Confirm this gift box', '이 선물박스로 전환 확인')}</button>
        <button type="button" onClick={() => setAllocation(null)}>{t('Cancel conversion', '전환 취소')}</button>
      </fieldset>}
    </>}
    {quote && <div className="renewal-total" aria-live="polite">
      <p>{t('Product subtotal', '상품 소계')} {money(quote.subtotalCents)}</p>
      <p>{t('Packaging', '포장비')} {money(quote.individualPackagingFeeCents)}</p>
      <strong>{money(quote.totalPriceCents)}</strong>
      <p>{quote.lines.reduce((n, l) => n + l.giftBoxCount, 0)} {t('gift boxes', '선물박스')} · {quote.lines.reduce((n, l) => n + l.physicalQuantity, 0)} {t('pieces total', '개 합계')}</p>
    </div>}
    {!quote && <p role="status">{t('Select four per gift box, or at least one single. Check that all quantities are valid.', '선물박스는 정확히 4개, 단품은 1개 이상 선택하고 수량을 확인해주세요.')}</p>}
    {error && <p role="alert">{error}</p>}
    <button type="button" disabled={!quote || allocation !== null} onClick={save}>{initial ? t('Save selection', '구성 저장') : t('Add this selection to bag', '이 구성으로 담기')}</button>
    {onCancel && <button type="button" onClick={onCancel}>{t('Cancel edit', '수정 취소')}</button>}
    {added && !initial && <div role="status">
      <p>{t('Added to your bag. Add again for more of the same selection.', '장바구니에 담았습니다. 같은 구성을 더 담을 수 있습니다.')}</p>
      <button type="button" onClick={() => { setGiftCounts(emptyCounts()); setQuantity(1); setMode('gift-four'); setAdded(false) }}>{t('Build a different box', '다른 구성 만들기')}</button>{' '}
      <a href="/cart">{t('View bag', '장바구니 보기')}</a>
    </div>}
  </fieldset>
}
