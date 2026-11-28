import { useEffect, useRef, useState } from "react";
import { useCart } from "../CartProvider";
import { useAuLanguage } from "../lib/au-language";
import { useCustomerAccount } from "../lib/customer-account-context";
import { readCheckoutResume, acknowledgeCheckoutResume, saveCheckoutForRefresh, checkoutCartSignature, fillUntouchedContact } from "../lib/customer-checkout-draft";
import { CheckoutAccountPrompt } from "../components/CheckoutAccountPrompt";
import { GuestCartImport } from "../components/GuestCartImport";
import { QuantityStepper } from "../components/ProductOptionControls";
import { MochiBuilder, MochiReselectionNotice } from "../components/MochiBuilder";
import { AuPickupNotice } from "../components/AuPickupNotice";
import { RenewalPickupDatePicker } from "../components/RenewalPickupDatePicker";
import { RenewalPaymentNotice } from "../components/RenewalPaymentNotice";
import { isAppwriteConfigured } from "../lib/appwrite";
import type { StoreSettings } from "../lib/types";
import { formatAudCents } from "../lib/utils";
import { RENEWAL_CARDS, HALLOWEEN_MERINGUE_CARD, halloweenMeringueAvailable, isHalloweenMeringue } from "../../appwrite-functions/reservation-api/src/au-renewal-catalog.js";
import { ALMOND_GIFT_BOX_ID, almondGiftBoxPriceCents, RENEWAL_CONTRACT, RENEWAL_OFFERS, MOCHI_FLAVOURS, MOCHI_DISPLAY_FLAVOURS, mochiFlavourName, renewalProductName, renewalFinishName, renewalSizeName, priceRenewalOrder } from "../../appwrite-functions/reservation-api/src/au-renewal.js";
import { renewalPickupSlots } from "../../appwrite-functions/reservation-api/src/au-renewal-pickup.js";
import { createRenewalOrder, renewalCapabilities } from "../lib/renewal-client";
import { almondPacks } from "../lib/almond-packs";
import { useAlmondGiftSale } from "../lib/use-almond-gift-sale";
import { renewalSelectionHref } from "../lib/renewal-cart";

function currentOrderTime(serverOffsetMs: number) {
  return new Date(Date.now() + serverOffsetMs);
}

function displaySummary(
  line: ReturnType<typeof priceRenewalOrder>["lines"][number],
  lines: ReturnType<typeof priceRenewalOrder>["lines"],
  ko: boolean,
) {
  const card = [...Object.values(RENEWAL_CARDS).flat(), HALLOWEEN_MERINGUE_CARD]
    .find((c) => c.offers.includes(line.productId));
  const parent = lines.find(
    (l) => l.selection.lineId === line.selection.parentLineId,
  );
  return [
    card?.id === "almond" ? `${ko ? card.ko : card.en} · ${almondPacks[line.productId][ko ? "ko" : "en"]}` :
      ko ? card?.ko || renewalProductName(line, "ko") : renewalProductName(line),
    renewalSizeName(line.selection.size, ko ? "ko" : "en"),
    line.selection.chocolateType ? (line.selection.chocolateType === "milk" ? (ko ? "밀크" : "Milk") : (ko ? "다크" : "Dark")) : null,
    renewalFinishName(line.selection.finish || "basic", ko ? "ko" : "en"),
    `${line.quantity}${ko ? "팩" : " pack(s)"} / ${line.physicalQuantity}${ko ? "개" : " pieces"}`,
    line.selection.mode
      ? `${
          line.selection.mode === "gift-four"
            ? (ko ? "박스당 구성: " : "Per box: ") +
              MOCHI_DISPLAY_FLAVOURS.filter((f) => line.selection.flavourCounts![f.id])
                .map(
                  (f) =>
                    `${mochiFlavourName(f.id, ko ? "ko" : "en")} ${line.selection.flavourCounts![f.id]}`,
                )
                .join(", ")
            : ko
              ? "단품"
              : "Singles"
        } · ${ko ? "맛별 총수량: " : "Flavour totals: "}${MOCHI_DISPLAY_FLAVOURS
          .map((f) => {
            const n = line.flavourTotals[MOCHI_FLAVOURS.findIndex(stored => stored.id === f.id)];
            return n ? `${mochiFlavourName(f.id, ko ? "ko" : "en")} ${n}` : "";
          })
          .filter(Boolean)
          .join(", ")}`
      : null,
    parent ? `${ko ? "추가상품:" : "Extra for:"} ${parent.productName}` : null,
    line.giftBoxCount
      ? `${ko ? "무료 4구박스" : "Free gift box"} ${line.giftBoxCount}`
      : null,
    line.individualPackaging
      ? `${ko ? "개별포장" : "Individual packaging"} ${line.individualPackagingPieces} · ${formatAudCents(line.individualPackagingFeeCents)}`
      : null,
    formatAudCents(line.totalPriceCents),
  ]
    .filter(Boolean)
    .join(" · ").split(/(AUD \d+\.\d{2})/).map((part, index) =>
      part.startsWith("AUD ") ? <span className="au-mobile-price" key={index}>{part}</span> : part);
}

function Bag({ settings }: { settings: StoreSettings }) {
  const customer = useCustomerAccount();
  const cart = useCart();
  const localPickupPreview = !isAppwriteConfigured && typeof window !== 'undefined' &&
    ['localhost', '127.0.0.1', '[::1]'].includes(window.location?.hostname ?? '');
  const {registerCheckout} = customer;
  const [resume] = useState(() => readCheckoutResume('renewal',cart.checkoutOwner));
  const restored = 'draft' in resume ? resume.draft : undefined;
  const [contact, setContact] = useState(() => ({ customerName: String(restored?.form.name || ''), customerPhone: String(restored?.form.phone || ''), customerEmail: String(restored?.form.email || '') }));
  const [extras,setExtras]=useState(()=>({note:String(restored?.form.note||''),promo:String(restored?.form.promo||''),privacy:restored?.form.privacy===true}));
  const [guest, setGuest] = useState(false), [cartChanged, setCartChanged] = useState(resume.status === 'cart-changed');
  const dirty = useRef(new Set(restored?.dirtyFields || [])), formElement = useRef<HTMLFormElement>(null);
  const { t, language } = useAuLanguage(),
    [error, setError] = useState(""),
    [date, setDate] = useState(String(restored?.form.date || '')),
    [time, setTime] = useState(String(restored?.form.time || '')),
    [busy, setBusy] = useState(false),
    [result, setResult] = useState(""),
    [resultPickup, setResultPickup] = useState(""),
    [editingMochi, setEditingMochi] = useState<string | null>(null);
  const [caps, setCaps] = useState({
    enabled: false,
    preordersEnabled: false,
    weekendApproved: true,
    serverOffsetMs: 0,
  });
  const almondSale = useAlmondGiftSale(caps.serverOffsetMs);
  const [pickupNow, setPickupNow] = useState(() => new Date());
  useEffect(() => {
    const refresh = () => setPickupNow(new Date());
    const timer = window.setInterval(refresh, 30_000);
    window.addEventListener('focus', refresh);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, []);
  const lock = useRef(false),
    requestId = useRef<string>(restored?.requestId || crypto.randomUUID());
  const observedCart=useRef<string|null>(null);
  useEffect(()=>{
    if(!cart.ready)return;
    const current=JSON.stringify(cart.renewalLines),previous=observedCart.current,changed=previous!==null&&previous!==current;
    observedCart.current=current;
    if(!changed)return;
    if(cart.changedInAnotherTab){let cancelled=false,applied=false;queueMicrotask(()=>{if(!cancelled){applied=true;setCartChanged(true)}});return ()=>{cancelled=true;if(!applied)observedCart.current=previous}}
    if(!cartChanged&&!lock.current)requestId.current=crypto.randomUUID();
  },[cart.ready,cart.renewalLines,cart.changedInAnotherTab,cartChanged]);
  useEffect(() => { if (restored && cart.ready && !cartChanged) acknowledgeCheckoutResume(restored); }, [restored,cart.ready,cartChanged]);
  useEffect(() => {
    if (guest || customer.state.status !== 'authenticated') return;
    const profile = customer.state.identity.profile;
    const modified = [...dirty.current].map(key => ({name:'customerName',phone:'customerPhone',email:'customerEmail'}[key] || key));
    let cancelled = false;
    queueMicrotask(() => { if (!cancelled) setContact(current => fillUntouchedContact(current, modified, profile)); });
    return () => { cancelled = true; };
  }, [guest, customer.state]);
  useEffect(() => {
    if (!cart.renewalLines.length || result) return;
    return registerCheckout(() => {
    if (!formElement.current || lock.current || !cart.isCurrent()) throw Error('AUTH_DRAFT_UNAVAILABLE');
    const values = new FormData(formElement.current);
    return {version:1,kind:'renewal',cartOwner:cart.owner||'guest',flowId:crypto.randomUUID(),savedAt:Date.now(),returnTo:window.location.pathname === '/reserve' ? '/reserve' : '/cart',requestId:requestId.current,
      form:{name:String(values.get('name')||''),phone:String(values.get('phone')||''),email:String(values.get('email')||''),date,time:renewalPickupSlots([...cart.renewalLines],date,new Date(),caps).includes(time)?time:'',note:String(values.get('note')||''),promo:String(values.get('promo')||''),privacy:values.get('privacy')==='on'},
      dirtyFields:[...dirty.current],checkoutContext:{},cartSnapshot:[...cart.renewalLines],cartSignature:checkoutCartSignature('renewal',cart.owner||'guest')};
    }, () => setGuest(true));
  }, [registerCheckout, cart, date, time, result, caps]);
  useEffect(() => {
    if (!isAppwriteConfigured) return;
    renewalCapabilities()
      .then(setCaps)
      .catch(() => {});
  }, []);
  const lines = [...cart.renewalLines];
  let quote: ReturnType<typeof priceRenewalOrder> | null = null;
  try {
    if (lines.length) quote = priceRenewalOrder(lines, { localPreview: true, now: currentOrderTime(caps.serverOffsetMs) });
  } catch {
    /* keep invalid cart visible for correction */
  }
  const giftLine = quote?.lines.find(line => line.productId === ALMOND_GIFT_BOX_ID);
  const giftPriceChanged = t("The gift box price has changed. Review your updated total before sending your request.", "선물 박스 가격이 변경되었습니다. 새 주문 합계를 확인한 뒤 예약 요청을 보내주세요.");
  // A disconnected loopback preview can demonstrate the existing pickup rules,
  // but never grants reservation capability or reaches the submission transport.
  const pickupPolicy = localPickupPreview
    ? { ...caps, enabled: true, preordersEnabled: true }
    : caps;
  const slots = renewalPickupSlots(lines, date, pickupNow, pickupPolicy);
  const seasonalClosed = lines.some(l => isHalloweenMeringue(l.offerId)) && !halloweenMeringueAvailable(pickupNow);
  const selectedTime = slots.includes(time) ? time : '';
  const provisional = quote?.lines.some((l) => l.priceStatus === "provisional");
  const newProducts = lines.some((l) => RENEWAL_OFFERS[l.offerId].newProduct);
  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (localPickupPreview) return;
    if (!cart.isCurrent() || lock.current || editingMochi !== null || cartChanged || (customer.enabled && !guest && customer.state.status === 'checking')) return;
    if (giftLine && giftLine.unitPriceCents !== almondGiftBoxPriceCents(currentOrderTime(caps.serverOffsetMs))) {
      setPickupNow(new Date());
      setError(giftPriceChanged);
      return;
    }
    if (!caps.enabled || !renewalPickupSlots(lines, date, new Date(), caps).includes(time)) {
      setPickupNow(new Date());
      setError(t('Please select an available pickup date and time.', '픽업 가능한 날짜와 시간을 선택해주세요.'));
      return;
    }
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const values = new FormData(event.currentTarget);
      const response = await createRenewalOrder({
        contractVersion: RENEWAL_CONTRACT,
        customerName: values.get("name"),
        customerPhone: values.get("phone"),
        customerEmail: values.get("email"),
        pickupDate: date,
        pickupTime: time,
        requestNote: values.get("note"),
        promoCode: values.get("promo"),
        privacyConsent: values.get("privacy") === "on",
        website: "",
        requestId: requestId.current,
        orderLines: lines,
        ...(giftLine && {expectedAlmondGiftBoxPriceCents: giftLine.unitPriceCents}),
      }, customer.enabled && !guest && customer.state.status === 'authenticated' ? {customerAccount:'link'} : undefined);
      if(!cart.isCurrent())return;
      setResult(String(response.reservationNumber));
      setResultPickup(
        `${response.pickupDate} ${response.pickupTime} (Australia/Sydney)`,
      );
      cart.removeRenewalSubmitted(lines);
    } catch (e) {
      if (e instanceof Error && e.message === "ALMOND_PRICE_CHANGED") {
        await renewalCapabilities().then(setCaps).catch(() => {});
        setPickupNow(new Date());
        setError(giftPriceChanged);
        return;
      }
      if (e instanceof Error && /UNSUPPORTED_CONTRACT|RENEWAL_UNAVAILABLE/.test(e.message)) {
        try {
          const href = saveCheckoutForRefresh(sessionStorage, {
            version: 1, kind: 'renewal', cartOwner: cart.owner || 'guest', flowId: crypto.randomUUID(), savedAt: new Date().getTime(),
            returnTo: window.location.pathname === '/reserve' ? '/reserve' : '/cart', requestId: requestId.current,
            form: { name: contact.customerName, phone: contact.customerPhone, email: contact.customerEmail, date, time,
              note: extras.note, promo: extras.promo, privacy: extras.privacy }, dirtyFields: [...dirty.current],
            checkoutContext: {}, cartSnapshot: lines, cartSignature: checkoutCartSignature('renewal', cart.owner || 'guest'),
          }, window.location.href);
          if (href) window.history.replaceState(null, '', href);
        } catch { /* Form entries remain on this page when session storage is unavailable. */ }
      }
      setError(
        e instanceof Error && /UNSUPPORTED_CONTRACT|RENEWAL_UNAVAILABLE/.test(e.message)
          ? t("The menu has been updated. Your bag is saved and your entries are kept on this page. Review the current options and refresh before trying again.", "메뉴가 업데이트되었습니다. 장바구니는 보관되며 입력 내용은 이 화면에 유지됩니다. 현재 구성을 확인하고 새로고침 후 다시 시도해주세요.")
          : e instanceof Error ? e.message : t("Please try again.", "다시 시도해주세요."),
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  if(!cart.ready)return <main className="renewal-page" role="status">{t('Checking your account…','계정을 확인하고 있습니다…')}</main>;
  if (result)
    return (
      <main className="renewal-page">
        <h1>{t("Request received", "예약 요청 접수")}</h1>
        <p>{result}</p>
        <p>{resultPickup}</p>
        <AuPickupNotice language={language} />
        <RenewalPaymentNotice settings={settings} language={language} reservationNumber={result} />
        <a href="/lookup">{t("Order lookup", "주문 조회")}</a>
      </main>
    );
  return (
    <main className="renewal-page renewal-cart">
      <h1>{t("Your bag", "장바구니")}</h1>
      {customer.enabled && <p>{customer.state.status === "authenticated" ? `${t("Account bag", "회원 장바구니")} · ${customer.state.identity.loginEmail}` : t("Guest bag", "비회원 장바구니")}</p>}
      <GuestCartImport language={language}/>
      {resume.status==='owner-changed'&&<p role="status">{t('The saved checkout belongs to another account. Sign back in to that account to restore it.','저장된 주문서는 다른 회원의 주문서입니다. 해당 계정으로 다시 로그인하면 복원할 수 있습니다.')}</p>}
      <MochiReselectionNotice />
      {cart.almondReselectionLines.map(line => (
        <section key={line.lineId} className="renewal-seasonal-note">
          <p>{t("Your saved 80g triangle box is no longer offered. The current triangle box contains 60g. Review the new pack before adding it to this order.", "담아두신 80g 삼각박스는 판매가 종료되었습니다. 현재 삼각박스는 60g입니다. 새 구성을 확인한 뒤 장바구니에 담아주세요.")} ×{line.quantity}</p>
          <a href={renewalSelectionHref(line, line.lineId)!}>{t("Review almond packs", "아몬드 구성 확인")}</a>{" "}
          <button type="button" onClick={() => cart.removeRenewal(line.lineId)}>{t("Remove saved selection", "이전 구성 삭제")}</button>
        </section>
      ))}
      {cart.paveReselectionLines.length > 0 && <section className="renewal-seasonal-note" aria-label={t("Saved Milk selections", "보관된 밀크 선택")}>
        <p role="alert">{t("Milk chocolate Pavé is no longer available. These selections are saved separately; re-select or remove them. Other items in your bag are kept.", "파베 밀크 초콜릿 판매가 종료되었습니다. 해당 선택은 별도 보관되어 있으니 다시 선택하거나 삭제해주세요. 다른 장바구니 상품은 유지됩니다.")}</p>
        {cart.paveReselectionLines.map((line, index) => <p key={index}><span>{renewalSizeName(line.size, language)} · {t("Milk", "밀크")} ×{line.quantity} </span><a href={renewalSelectionHref(line) || "/cakes/pave-chocolate-cake"}>{t("Re-select Pavé", "파베 다시 선택")}</a></p>)}
        <button type="button" onClick={cart.acknowledgePaveReselection}>{t("Remove saved Milk selections", "보관된 밀크 선택 삭제")}</button>
      </section>}
      {seasonalClosed && <p className="renewal-seasonal-note" role="alert">{t("Halloween orders have closed. Your selections are saved; remove the meringue packs to order other products. Existing reservations are unchanged.", "할로윈 주문이 마감되었습니다. 담긴 상품은 보존되어 있습니다. 다른 상품을 주문하려면 머랭쿠키를 삭제해주세요. 기존 예약은 유지됩니다.")}</p>}
      {cart.lines.length > 0 && (
        <p role="status">
          {t(
            "Your previous selections are saved. Prices and packs have changed; please select them again from the current menu.",
            "이전 선택은 보관되어 있습니다. 가격·구성이 변경되어 현재 메뉴에서 다시 선택해주세요.",
          )}
        </p>
      )}
      {!lines.length ? (
        <div className="renewal-empty-bag">
          <p>{t("Your bag is empty. Choose something you would like to enjoy.", "장바구니가 비어 있습니다. 원하는 상품을 골라 담아주세요.")}</p>
          <a href="/cakes">{t("Explore the menu", "메뉴 보기")}</a>
        </div>
      ) : (
        <>
          <ul className="renewal-bag">
            {lines.map((line) => (
              <li key={line.lineId}>
                <p>
                  {quote?.lines.find((l) => l.selection.lineId === line.lineId)
                    ? displaySummary(
                        quote.lines.find(
                          (l) => l.selection.lineId === line.lineId,
                        )!,
                        quote.lines,
                        language === "ko",
                      )
                    : RENEWAL_OFFERS[line.offerId].name}
                </p>
                {line.mode !== "singles" && editingMochi !== line.lineId && (
                  <QuantityStepper
                    min={1}
                    label={t("Quantity", "수량")}
                    value={line.quantity}
                    onChange={(n) => {
                      if (lock.current) return;
                      try {
                        priceRenewalOrder(
                          lines.map((l) =>
                            l.lineId === line.lineId
                              ? { ...l, quantity: n }
                              : l,
                          ),
                          { localPreview: true },
                        );
                        cart.updateRenewal(line.lineId, n);
                        requestId.current = crypto.randomUUID();
                      } catch {
                        setError(
                          t(
                            "Please check the quantity.",
                            "수량을 확인해주세요.",
                          ),
                        );
                      }
                    }}
                  />
                )}
                {["pave-cake", "brownie-whole", "brownie-loaf", "pound-cake"].includes(line.offerId) && <a href={renewalSelectionHref(line, line.lineId)!}>{t("Edit cake selection", "케이크 구성 수정")}</a>}
                {almondPacks[line.offerId] && <a href={renewalSelectionHref(line, line.lineId)!}>{t("Edit almond pack", "아몬드 구성 수정")}</a>}
                {line.offerId === "mochi" &&
                  (editingMochi === line.lineId ? (
                    <MochiBuilder
                      key={line.lineId}
                      initial={line}
                      disabled={busy}
                      onCancel={() => setEditingMochi(null)}
                      onSave={(next) => {
                        if (lock.current) return;
                        cart.replaceRenewal(line.lineId, next);
                        requestId.current = crypto.randomUUID();
                        setEditingMochi(null);
                      }}
                    />
                  ) : (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setEditingMochi(line.lineId)}
                    >
                      {t("Edit mochi selection", "모찌 구성 수정")}
                    </button>
                  ))}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    cart.removeRenewal(line.lineId);
                    if (editingMochi === line.lineId) setEditingMochi(null);
                    requestId.current = crypto.randomUUID();
                  }}
                >
                  {t(
                    "Remove (including attached extras)",
                    "삭제 (연결 추가상품 포함)",
                  )}
                </button>
              </li>
            ))}
          </ul>
          {giftLine && cart.giftBoxAddedOnSale && !almondSale && <p role="status" className="renewal-seasonal-note">{t("The almond gift box offer has ended. Your bag now shows the regular price of AUD 50 per box.", "아몬드 선물 박스 행사가 종료되어 장바구니에 박스당 정상가 AUD 50이 적용되었습니다.")}</p>}
          {quote && <h2 className="au-mobile-price"><span className="au-mobile-price">{formatAudCents(quote.totalPriceCents)}</span></h2>}
          <form
            ref={formElement}
            className="renewal-checkout"
            onSubmit={submit}
            onChange={(event) => {
              const target = event.target;
              if ((target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) && target.name) dirty.current.add(target.name);
              if (!lock.current && !cartChanged) requestId.current = crypto.randomUUID();
            }}
          >
            <h2>{t("Request a reservation", "예약 요청")}</h2>
            <CheckoutAccountPrompt language={language} guest={guest} onGuest={setGuest} />
            {cartChanged && <div role="status"><p>{t('Your bag changed. Your form is saved. Review the current items before sending.','장바구니의 상품이 변경되었습니다. 주문서는 보관했습니다. 현재 상품을 확인한 뒤 보내주세요.')}</p><button type="button" onClick={() => { requestId.current = crypto.randomUUID(); setCartChanged(false); }}>{t('I have reviewed the current bag','현재 장바구니 확인 완료')}</button></div>}
            <fieldset className="renewal-checkout-fields" disabled={busy}>
              <label>
                {t("Name", "이름")}
                <input name="name" required minLength={2} maxLength={80} value={contact.customerName} onChange={event => setContact(current => ({...current,customerName:event.target.value}))} />
              </label>
              <label>
                {t("Australian mobile", "호주 휴대전화")}
                <input name="phone" type="tel" required value={contact.customerPhone} onChange={event => setContact(current => ({...current,customerPhone:event.target.value}))} />
              </label>
              <label>
                {t("Email", "이메일")}
                <input name="email" type="email" required maxLength={120} value={contact.customerEmail} onChange={event => setContact(current => ({...current,customerEmail:event.target.value}))} />
              </label>
              <RenewalPickupDatePicker
                value={date}
                lines={lines}
                policy={pickupPolicy}
                language={language}
                now={pickupNow}
                onChange={(nextDate) => {
                  if (lock.current || !cart.isCurrent() || nextDate === date) return;
                  setDate(nextDate);
                  setTime('');
                  dirty.current.add('date');
                  requestId.current = crypto.randomUUID();
                  setError('');
                }}
              />
              <label>
                {t("Pickup time", "픽업 시간")}
                <select
                  required
                  value={selectedTime}
                  onChange={(e) => setTime(e.target.value)}
                >
                  <option value="">{t("Select time", "시간 선택")}</option>
                  {slots.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <AuPickupNotice language={language} driver />
              {date &&
                !slots.length &&
                (!newProducts || caps.preordersEnabled) && (
                  <p role="status">
                    {t(
                      "No pickup slots are available on this date. Please choose another date.",
                      "이 날짜에는 선택 가능한 픽업 시간이 없습니다. 다른 날짜를 선택해주세요.",
                    )}
                  </p>
                )}
              <p>
                {t(
                  "Shown total is before any coupon. Valid discounts are checked by the server.",
                  "표시 합계는 쿠폰 적용 전입니다. 유효 할인은 서버에서 확인합니다.",
                )}
              </p>
              <label>
                {t("Promo code", "쿠폰 코드")}
                <input name="promo" maxLength={80} value={extras.promo} onChange={event=>setExtras(current=>({...current,promo:event.target.value}))} />
              </label>
              <label>
                {t("Note", "요청사항")}
                <textarea name="note" maxLength={1000} value={extras.note} onChange={event=>setExtras(current=>({...current,note:event.target.value}))} />
              </label>
              <label className="renewal-check">
                <input name="privacy" type="checkbox" required checked={extras.privacy} onChange={event=>setExtras(current=>({...current,privacy:event.target.checked}))} />
                {t(
                  "I agree to the use of my details to process this request.",
                  "예약 처리를 위한 개인정보 이용에 동의합니다.",
                )}
              </label>
              {localPickupPreview ? (
                <p role="status">{t(
                  'Local preview: you can select a pickup date and time. Reservations cannot be sent.',
                  '미리보기에서는 날짜와 시간만 선택할 수 있으며, 예약은 전송되지 않습니다.',
                )}</p>
              ) : (!caps.enabled ||
                (newProducts && !caps.preordersEnabled) ||
                provisional) && (
                <p role="status">
                  {t(
                    "Online requests for this selection are not open yet. Your bag is saved.",
                    "이 구성의 온라인 예약 접수는 아직 열리지 않았습니다. 장바구니는 보관됩니다.",
                  )}
                </p>
              )}
            </fieldset>
            <RenewalPaymentNotice settings={settings} language={language} />
            <button
              disabled={
                localPickupPreview || busy ||
                cartChanged ||
                (customer.enabled && !guest && customer.state.status === 'checking') ||
                !caps.enabled ||
                editingMochi !== null ||
                !!provisional ||
                (newProducts && !caps.preordersEnabled) ||
                !quote ||
                !slots.includes(time)
              }
            >
              {busy
                ? t("Submitting…", "접수 중…")
                : t("Send request", "예약 요청 보내기")}
            </button>
          </form>
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </main>
  );
}
export default function AuRenewalBag({ settings }: { settings: StoreSettings }) {
  const cart = useCart();
  return <Bag key={cart.checkoutOwner} settings={settings} />;
}
