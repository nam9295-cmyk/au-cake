import { AuPickupNotice } from "../components/AuPickupNotice";
import { getCakeEditorialBySlug } from "../lib/cake-editorial";
import { useEffect, useRef, useState } from "react";
import { useCart } from "../CartProvider";
import { useAuLanguage } from "../lib/au-language";
import {
  RENEWAL_CARDS,
  RENEWAL_NAV,
  renewalCardForPath,
  type RenewalCard,
} from "../../appwrite-functions/reservation-api/src/au-renewal-catalog.js";
import {
  RENEWAL_CONTRACT,
  RENEWAL_OFFERS,
  MOCHI_NAMES,
  priceRenewalOrder,
  type RenewalSelection,
} from "../../appwrite-functions/reservation-api/src/au-renewal.js";
import { renewalPickupSlots } from "../../appwrite-functions/reservation-api/src/au-renewal-pickup.js";
import { createRenewalOrder, renewalCapabilities } from "../lib/renewal-client";
import { addRenewalLines } from "../lib/renewal-cart";
function displaySummary(
  line: ReturnType<typeof priceRenewalOrder>["lines"][number],
  lines: ReturnType<typeof priceRenewalOrder>["lines"],
  ko: boolean,
) {
  const card = Object.values(RENEWAL_CARDS)
    .flat()
    .find((c) => c.offers.includes(line.productId));
  const parent = lines.find(
    (l) => l.selection.lineId === line.selection.parentLineId,
  );
  return [
    ko ? card?.ko || line.productName : line.productName,
    line.selection.size,
    labelFinish(line.selection.finish || "basic", ko),
    `${line.quantity}${ko ? "팩" : " pack(s)"} / ${line.physicalQuantity}${ko ? "개" : " pieces"}`,
    line.selection.mode
      ? `${line.selection.mode} · ${line.flavourTotals.map((n, i) => `${ko ? ["딸기", "청포도", "아망드 쇼콜라", "앙버터"][i] : MOCHI_NAMES[i]} ${n}`).join(", ")}`
      : null,
    parent ? `${ko ? "추가상품:" : "Extra for:"} ${parent.productName}` : null,
    line.giftBoxCount
      ? `${ko ? "무료 4구박스" : "Free gift box"} ${line.giftBoxCount}`
      : null,
    line.individualPackaging
      ? `${ko ? "개별포장" : "Individual packaging"} ${line.individualPackagingPieces} · ${money(line.individualPackagingFeeCents)}`
      : null,
    money(line.totalPriceCents),
  ]
    .filter(Boolean)
    .join(" · ");
}
const money = (n: number) => `AUD ${(n / 100).toFixed(2)}`;
const localPreview = import.meta.env.DEV;
const labelFinish = (f: string, ko: boolean) =>
  ({
    basic: ko ? "기본" : "Basic",
    "vanilla-fresh-cream": ko ? "바닐라 생크림" : "Vanilla Fresh Cream",
    "chocolate-buttercream": ko ? "초코 버터크림" : "Chocolate Buttercream",
    "extra-chocolate": ko ? "초콜릿 추가" : "Extra Chocolate",
  })[f] || f;
function NumberField({
  label,
  value,
  onChange,
  min = 0,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
}) {
  return (
    <label className="renewal-number">
      {label}
      <input
        type="number"
        min={min}
        step="1"
        inputMode="numeric"
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isSafeInteger(n) && n >= min) onChange(n);
        }}
      />
    </label>
  );
}
function cardPrice(card: RenewalCard) {
  if (card.id === "mochi") return "Signature 4 · AUD 35.00";
  const p = RENEWAL_OFFERS[card.offers[0]];
  return p.price === null || (p.provisional && !localPreview)
    ? ""
    : money(p.price);
}
export function RenewalCollection({
  category,
}: {
  category: keyof typeof RENEWAL_CARDS;
}) {
  const { language, t } = useAuLanguage();
  return (
    <main className="renewal-page">
      <h1>{RENEWAL_NAV.find((n) => n.href === `/${category}`)?.en}</h1>
      <div className="renewal-grid">
        {RENEWAL_CARDS[category].map((card) => (
          <article key={card.id} data-au-product={card.id}>
            <a href={card.href}>
              {card.image ? (
                <img
                  src={card.image}
                  alt={language === "ko" ? card.ko : card.en}
                  width="600"
                  height="600"
                />
              ) : (
                <div className="renewal-photo-pending" aria-hidden="true" />
              )}
              <h2>{language === "ko" ? card.ko : card.en}</h2>
              <p>{cardPrice(card)}</p>
              {["mochi", "cookies"].includes(card.id) && (
                <p>
                  {t(
                    "Pre-orders from 19 October 2026",
                    "2026년 10월 19일 사전예약 시작",
                  )}
                </p>
              )}
            </a>
          </article>
        ))}
      </div>
    </main>
  );
}
function Product({ card }: { card: RenewalCard }) {
  const { language, t } = useAuLanguage(),
    ko = language === "ko";
  const cart = useCart(),
    [error, setError] = useState(""),
    [added, setAdded] = useState(false);
  const params = new URLSearchParams(window.location.search);
  const initialOffer = card.offers.includes(params.get("offer") || "")
    ? params.get("offer")!
    : card.offers[0];
  const [offerId, setOffer] = useState(initialOffer),
    [size, setSize] = useState(params.get("size") || "6in"),
    [finish, setFinish] = useState(params.get("finish") || "basic"),
    [chocolateType, setChocolate] = useState("dark");
  const [quantity, setQuantity] = useState(1),
    [packaging, setPackaging] = useState(false),
    [mode, setMode] = useState("signature"),
    [counts, setCounts] = useState([1, 1, 1, 1]);
  const [packs, setPacks] = useState<
    Record<string, { quantity: number; finish: string; packaging: boolean }>
  >(() =>
    Object.fromEntries(
      card.offers.map((id, i) => [
        id,
        { quantity: i === 0 ? 1 : 0, finish: "basic", packaging: false },
      ]),
    ),
  );
  const [addons, setAddons] = useState<Record<string, number>>({});
  const editorial = getCakeEditorialBySlug(
    card.href.split("?")[0].split("/").at(-1)!,
    language,
  );
  const p = RENEWAL_OFFERS[offerId],
    isCup = p.family === "cupcake",
    isMochi = p.family === "mochi";
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("offer", offerId);
    if (p.sizes) url.searchParams.set("size", size);
    else url.searchParams.delete("size");
    url.searchParams.set("finish", finish);
    window.history.replaceState(window.history.state, "", url);
  }, [offerId, size, finish, p.sizes]);
  let selection: RenewalSelection[] = [];
  if (isCup)
    selection = card.offers
      .filter((id) => packs[id].quantity > 0)
      .map((id, i) => ({
        lineId: `preview-${i}`,
        offerId: id,
        quantity: packs[id].quantity,
        finish: packs[id].finish,
        individualPackaging: packs[id].packaging,
      }));
  else
    selection = [
      {
        lineId: "preview-0",
        offerId,
        quantity: isMochi && mode === "quantity" ? 1 : quantity,
        finish,
        individualPackaging: packaging,
        ...(p.sizes ? { size } : {}),
        ...(p.chocolate ||
        (offerId === "pound-cake" && finish === "extra-chocolate")
          ? { chocolateType }
          : {}),
        ...(isMochi
          ? { mode, ...(mode === "signature" ? {} : { counts }) }
          : {}),
      },
    ];
  if (p.family === "cake")
    for (const [id, n] of Object.entries(addons))
      if (n > 0)
        selection.push({
          lineId: `preview-${id}`,
          offerId: id,
          quantity: n,
          parentLineId: "preview-0",
        });
  let quote: ReturnType<typeof priceRenewalOrder> | null = null,
    reason = "";
  try {
    quote = priceRenewalOrder(selection, { localPreview });
  } catch (e) {
    reason = e instanceof Error ? e.message : "INVALID_SELECTION";
  }
  const same =
    isMochi && mode === "custom-four" && counts.every((n) => n === 1);
  function add(signature = false) {
    try {
      const ids = new Map(
        selection.map((l) => [l.lineId, crypto.randomUUID()]),
      );
      const next = selection.map((l) => ({
        ...l,
        lineId: ids.get(l.lineId)!,
        ...(l.parentLineId ? { parentLineId: ids.get(l.parentLineId)! } : {}),
        ...(signature && l.offerId === "mochi"
          ? { mode: "signature", counts: [1, 1, 1, 1] }
          : {}),
      }));
      priceRenewalOrder(next, { localPreview });
      addRenewalLines(cart.renewalLines, next);
      cart.addRenewal(next);
      setAdded(true);
      setError("");
    } catch {
      setError(
        t(
          "Please check your selections and quantities.",
          "선택과 수량을 확인해주세요.",
        ),
      );
    }
  }
  return (
    <main className="renewal-page renewal-detail">
      <a
        href={
          p.family === "cupcake" || p.family === "smore"
            ? "/celebrate"
            : isMochi || !p.family
              ? "/chocolates"
              : "/cakes"
        }
      >
        {t("Back to collection", "상품 목록")}
      </a>
      <div className="renewal-detail-grid">
        <section>
          {card.image && (
            <img
              className="renewal-hero"
              src={card.image}
              alt={ko ? card.ko : card.en}
            />
          )}
          <h1>{ko ? card.ko : card.en}</h1>
          <AuPickupNotice language={language} driver />
          {p.newProduct && (
            <p>
              {t(
                "Pre-orders from 19 October 2026. Please allow at least 24 hours before collection.",
                "2026년 10월 19일 사전예약 시작. 픽업까지 최소 24시간이 필요합니다.",
              )}
            </p>
          )}
          {card.id === "cookies" && (
            <p>
              {t(
                "3 Chocolate Chip + 3 Double Chocolate in each box.",
                "한 박스에 초코칩 3개 + 더블초코 3개.",
              )}
            </p>
          )}
          <p>
            {t(
              "Made to order. Availability is confirmed after your request.",
              "주문 제작 상품입니다. 신청 후 가능 여부를 확인해드립니다.",
            )}
          </p>
          {editorial && (
            <p>
              {"ingredientsAndAllergens" in editorial
                ? editorial.ingredientsAndAllergens.allergens
                : editorial.ingredients.allergens}
            </p>
          )}
          <p>
            {t(
              "Please contact us about ingredients and allergies before ordering.",
              "원재료와 알레르기는 주문 전 문의해주세요.",
            )}
          </p>
        </section>
        <section className="renewal-options">
          {card.id.startsWith("brownie-") && p.family === "cake" && (
            <nav className="renewal-inline">
              <a href="/cakes/brownie-cheesecake?form=whole">
                {t("Whole Cake", "홀케이크")}
              </a>
              <a href="/cakes/brownie-cheesecake?form=loaf">
                {t("Loaf", "로프")}
              </a>
            </nav>
          )}
          {!isCup && card.offers.length > 1 && (
            <label>
              {t("Pack", "구성")}
              <select
                value={offerId}
                onChange={(e) => {
                  setOffer(e.target.value);
                  setFinish("basic");
                }}
              >
                {card.offers.map((id) => (
                  <option key={id} value={id}>
                    {RENEWAL_OFFERS[id].name} ·{" "}
                    {money(RENEWAL_OFFERS[id].price!)}
                  </option>
                ))}
              </select>
            </label>
          )}
          {p.sizes && (
            <label>
              {t("Size", "사이즈")}
              <select value={size} onChange={(e) => setSize(e.target.value)}>
                {Object.keys(p.sizes).map((s) => (
                  <option key={s} value={s}>
                    {s.replace("in", "″")}
                    {!p.provisionalSizes?.includes(s) || localPreview
                      ? ` · ${money(p.sizes![s])}`
                      : ""}
                  </option>
                ))}
              </select>
            </label>
          )}
          {isCup ? (
            card.offers.map((id) => {
              const offer = RENEWAL_OFFERS[id],
                pack = packs[id];
              return (
                <fieldset key={id}>
                  <legend>
                    {offer.pieces}
                    {t(" cupcakes per box", "개 / 박스")}
                  </legend>
                  <label>
                    {t("Finish", "토핑")}
                    <select
                      value={pack.finish}
                      onChange={(e) =>
                        setPacks({
                          ...packs,
                          [id]: { ...pack, finish: e.target.value },
                        })
                      }
                    >
                      {Object.entries(offer.finishes!).map(([f, cents]) => (
                        <option key={f} value={f}>
                          {labelFinish(f, ko)}
                          {!offer.provisional || localPreview
                            ? ` · ${money(cents)}`
                            : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  <NumberField
                    label={t("Boxes", "박스 수")}
                    value={pack.quantity}
                    onChange={(n) =>
                      setPacks({ ...packs, [id]: { ...pack, quantity: n } })
                    }
                  />
                  <p>
                    {pack.quantity}
                    {t(" boxes", "박스")} · {pack.quantity * offer.pieces}
                    {t(" cupcakes", "개")}
                  </p>
                  <label className="renewal-check">
                    <input
                      type="checkbox"
                      checked={pack.packaging}
                      onChange={(e) =>
                        setPacks({
                          ...packs,
                          [id]: { ...pack, packaging: e.target.checked },
                        })
                      }
                    />
                    {t("Individual packaging", "개별포장")}
                  </label>
                </fieldset>
              );
            })
          ) : (
            <>
              {(p.finishes || p.cream) && (
                <label>
                  {t("Finish", "토핑")}
                  <select
                    value={finish}
                    onChange={(e) => setFinish(e.target.value)}
                  >
                    {Object.keys(
                      p.finishes || { basic: 0, "vanilla-fresh-cream": 1000 },
                    ).map((f) => (
                      <option key={f} value={f}>
                        {labelFinish(f, ko)}
                        {p.cream && f !== "basic" ? " + AUD 10.00" : ""}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {(p.chocolate ||
                (offerId === "pound-cake" && finish === "extra-chocolate")) && (
                <label>
                  {t("Chocolate", "초콜릿")}
                  <select
                    value={chocolateType}
                    onChange={(e) => setChocolate(e.target.value)}
                  >
                    <option value="dark">{t("Dark", "다크")}</option>
                    <option value="milk">{t("Milk", "밀크")}</option>
                  </select>
                </label>
              )}
              {isMochi && (
                <>
                  <label>
                    {t("Choose your order", "주문 방식")}
                    <select
                      value={mode}
                      onChange={(e) => {
                        setMode(e.target.value);
                        setPackaging(false);
                        setQuantity(1);
                      }}
                    >
                      <option value="signature">
                        {t("Signature 4 · AUD 35", "시그니처 4구 · AUD 35")}
                      </option>
                      <option value="custom-four">
                        {t("Choose your four flavours", "원하는 맛 4개 고르기")}
                      </option>
                      <option value="quantity">
                        {t("Choose any quantity", "원하는 수량 주문")}
                      </option>
                    </select>
                  </label>
                  {mode === "signature" ? (
                    <p>
                      {t(
                        "One of each flavour. Free four-piece gift box.",
                        "네 맛 각 1개. 4구 기프트박스 무료.",
                      )}
                    </p>
                  ) : (
                    <>
                      <div className="renewal-flavours">
                        {MOCHI_NAMES.map((name, i) => (
                          <NumberField
                            key={name}
                            label={
                              ko
                                ? ["딸기", "청포도", "아망드 쇼콜라", "앙버터"][
                                    i
                                  ]
                                : name
                            }
                            value={counts[i]}
                            onChange={(n) =>
                              setCounts(counts.map((v, j) => (j === i ? n : v)))
                            }
                          />
                        ))}
                      </div>
                      <p>
                        {counts.reduce((a, b) => a + b, 0)}
                        {t(" selected", "개 선택")}
                        {mode === "custom-four"
                          ? t(
                              " / 4 · gift box included",
                              " / 4 · 기프트박스 포함",
                            )
                          : ""}
                      </p>
                    </>
                  )}
                  {mode === "quantity" && (
                    <label className="renewal-check">
                      <input
                        type="checkbox"
                        checked={packaging}
                        onChange={(e) => setPackaging(e.target.checked)}
                      />
                      {t(
                        "Individual packaging · AUD 0.50 per mochi",
                        "개별포장 · 모찌 개당 AUD 0.50",
                      )}
                    </label>
                  )}
                </>
              )}
              {!(isMochi && mode === "quantity") && (
                <NumberField
                  label={
                    isMochi ? t("Boxes", "박스 수") : t("Quantity", "수량")
                  }
                  min={1}
                  value={quantity}
                  onChange={setQuantity}
                />
              )}
            </>
          )}
          {isCup && (
            <p>
              {t(
                "AUD 0.50 per cupcake. Free when the selected, individually packed cupcakes total AUD 100 before coupons.",
                "개별포장 개당 AUD 0.50. 포장을 선택한 컵케이크의 쿠폰 적용 전 상품액 합계 AUD 100 이상이면 포장비가 무료입니다.",
              )}
            </p>
          )}
          {p.family === "cake" && (
            <fieldset>
              <legend>
                {t(
                  "Add something extra · 5% off",
                  "함께 담는 추가상품 · 5% 할인",
                )}
              </legend>
              {[
                "addon-pave",
                "addon-cream",
                "addon-almond",
                "addon-eiffel",
              ].map((id) => (
                <NumberField
                  key={id}
                  label={`${RENEWAL_OFFERS[id].name} · ${money(RENEWAL_OFFERS[id].price! * 0.95)}`}
                  value={addons[id] || 0}
                  onChange={(n) => setAddons({ ...addons, [id]: n })}
                />
              ))}
            </fieldset>
          )}
          {same && (
            <div role="status">
              <p>
                {t(
                  "This is the same selection as our Signature 4.",
                  "시그니처 4구와 같은 구성이에요.",
                )}
              </p>
              <button type="button" onClick={() => add(true)}>
                {t("Add as AUD 35 Signature", "AUD 35 시그니처로 담기")}
              </button>
            </div>
          )}
          {quote && (
            <div className="renewal-total" aria-live="polite">
              <p>
                {t("Product subtotal", "상품 소계")}{" "}
                {money(quote.subtotalCents)}
              </p>
              <p>
                {t("Packaging", "포장비")}{" "}
                {money(quote.individualPackagingFeeCents)}
              </p>
              <strong>{money(quote.totalPriceCents)}</strong>
              {localPreview &&
                quote.lines.some((l) => l.priceStatus === "provisional") && (
                  <p>
                    {t(
                      "Local preview price — approval pending",
                      "로컬 검수용 잠정가 · 운영 승인 대기",
                    )}
                  </p>
                )}
            </div>
          )}
          {!quote && !same && (
            <p role="status">
              {reason === "PRICE_UNAVAILABLE" || reason === "PROVISIONAL_PRICE"
                ? t(
                    "Please contact us to enquire about this selection.",
                    "이 구성은 문의해주세요.",
                  )
                : t(
                    "Please check your quantities and selections.",
                    "수량과 구성을 확인해주세요.",
                  )}
            </p>
          )}
          {error && <p role="alert">{error}</p>}
          <button type="button" disabled={!quote} onClick={() => add()}>
            {t("Add to bag", "장바구니에 담기")}
          </button>
          {added && (
            <p role="status">
              {t("Added to your bag.", "장바구니에 담았습니다.")}{" "}
              <a href="/cart">{t("View bag", "장바구니 보기")}</a>
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
function Bag() {
  const { t, language } = useAuLanguage(),
    cart = useCart(),
    [error, setError] = useState(""),
    [date, setDate] = useState(""),
    [time, setTime] = useState(""),
    [busy, setBusy] = useState(false),
    [result, setResult] = useState(""),
    [resultPickup, setResultPickup] = useState("");
  const [caps, setCaps] = useState({
    enabled: false,
    preordersEnabled: false,
    weekendApproved: true,
  });
  const lock = useRef(false),
    requestId = useRef(crypto.randomUUID());
  useEffect(() => {
    renewalCapabilities()
      .then(setCaps)
      .catch(() => {});
  }, []);
  const lines = [...cart.renewalLines];
  let quote: ReturnType<typeof priceRenewalOrder> | null = null;
  try {
    if (lines.length) quote = priceRenewalOrder(lines, { localPreview: true });
  } catch {
    /* keep invalid cart visible for correction */
  }
  const slots = renewalPickupSlots(lines, date, new Date(), caps);
  const provisional = quote?.lines.some((l) => l.priceStatus === "provisional");
  const newProducts = lines.some((l) => RENEWAL_OFFERS[l.offerId].newProduct);
  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current) return;
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
      });
      setResult(String(response.reservationNumber));
      setResultPickup(
        `${response.pickupDate} ${response.pickupTime} (Australia/Sydney)`,
      );
      cart.removeRenewalSubmitted(lines);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : t("Please try again.", "다시 시도해주세요."),
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  if (result)
    return (
      <main className="renewal-page">
        <h1>{t("Request received", "예약 요청 접수")}</h1>
        <p>{result}</p>
        <p>{resultPickup}</p>
        <AuPickupNotice language={language} />
        <p>
          {t(
            "We will confirm availability and send payment details. Your order is confirmed after payment is checked.",
            "가능 여부를 확인한 후 결제 안내를 드립니다. 입금 확인 후 예약이 확정됩니다.",
          )}
        </p>
        <a href="/lookup">{t("Order lookup", "주문 조회")}</a>
      </main>
    );
  return (
    <main className="renewal-page">
      <h1>{t("Your bag", "장바구니")}</h1>
      {cart.lines.length > 0 && (
        <p role="status">
          {t(
            "Your previous selections are saved. Prices and packs have changed; please select them again from the current menu.",
            "이전 선택은 보관되어 있습니다. 가격·구성이 변경되어 현재 메뉴에서 다시 선택해주세요.",
          )}
        </p>
      )}
      {!lines.length ? (
        <a href="/cakes">{t("Explore the menu", "메뉴 보기")}</a>
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
                {line.mode !== "quantity" && (
                  <NumberField
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
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    cart.removeRenewal(line.lineId);
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
          {quote && <h2>{money(quote.totalPriceCents)}</h2>}
          <form
            className="renewal-checkout"
            onSubmit={submit}
            onChange={() => {
              if (!lock.current) requestId.current = crypto.randomUUID();
            }}
          >
            <h2>{t("Request a reservation", "예약 요청")}</h2>
            <fieldset className="renewal-checkout-fields" disabled={busy}>
              <label>
                {t("Name", "이름")}
                <input name="name" required minLength={2} maxLength={80} />
              </label>
              <label>
                {t("Australian mobile", "호주 휴대전화")}
                <input name="phone" type="tel" required />
              </label>
              <label>
                {t("Email", "이메일")}
                <input name="email" type="email" required maxLength={120} />
              </label>
              <label>
                {t("Pickup date", "픽업 날짜")}
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => {
                    setDate(e.target.value);
                    setTime("");
                  }}
                />
              </label>
              <label>
                {t("Pickup time", "픽업 시간")}
                <select
                  required
                  value={time}
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
                <input name="promo" maxLength={80} />
              </label>
              <label>
                {t("Note", "요청사항")}
                <textarea name="note" maxLength={1000} />
              </label>
              <label className="renewal-check">
                <input name="privacy" type="checkbox" required />
                {t(
                  "I agree to the use of my details to process this request.",
                  "예약 처리를 위한 개인정보 이용에 동의합니다.",
                )}
              </label>
              {(!caps.enabled ||
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
            <button
              disabled={
                busy ||
                !caps.enabled ||
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
export function AuRenewalShop({ path }: { path: string }) {
  path = path.replace(/\/+$/, "") || "/";
  const { t } = useAuLanguage();
  if (path === "/cart" || path === "/reserve") return <Bag />;
  const category = path.slice(1) as keyof typeof RENEWAL_CARDS;
  if (Object.hasOwn(RENEWAL_CARDS, category))
    return <RenewalCollection category={category} />;
  if (path === "/business")
    return (
      <main className="renewal-page">
        <h1>Business</h1>
        <nav className="renewal-service-links">
          <a href="/business/cafe-supply">{t("Café supply", "납품")}</a>
          <a href="/business/events">
            {t("Events, pop-ups & collaboration", "행사·팝업·협업")}
          </a>
          <a href="/business/consulting">
            {t("Menu consulting", "메뉴 컨설팅")}
          </a>
        </nav>
      </main>
    );
  if (path === "/custom-cakes")
    return (
      <main className="renewal-page">
        <h1>Custom Cake</h1>
        <nav className="renewal-service-links">
          <a href="/cakes/custom-cake">
            {t("Custom cake enquiry", "맞춤 케이크 주문")}
          </a>
          <a href="/classes">
            {t("Basic · one-tier class", "Basic · 1단 클래스")}
          </a>
          <a href="/classes">
            {t("Advanced · two-tier class", "Advanced · 2단 클래스")}
          </a>
        </nav>
      </main>
    );
  const card = renewalCardForPath(path, window.location.search);
  return card ? (
    <Product key={card.id} card={card} />
  ) : (
    <main className="renewal-page">
      <h1>{t("Explore our current menu", "현재 메뉴를 확인해주세요")}</h1>
      <p>
        {t(
          "This product is no longer available for new orders. Existing reservations are unchanged.",
          "이 상품은 신규 주문이 종료되었습니다. 기존 예약은 유지됩니다.",
        )}
      </p>
      <a href="/cakes">Cake & Bake</a>
    </main>
  );
}
