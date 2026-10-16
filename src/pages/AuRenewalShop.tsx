import {
  OptionButton,
  QuantityStepper,
  ProductPhoto,
  PurchaseBar,
} from "../components/ProductOptionControls";
import { AuPaveGallery } from "../components/AuPaveGallery";
import { AuDetailGallery } from "../components/AuDetailGallery";
import { AuRenewalProductStory } from "../components/AuRenewalProductStory";
import { renewalDetailPresentation } from "../lib/renewal-detail-presentation";
import { formatCurrentCakeSizeLabel } from "../lib/cake-serving";
import gateauBasic from "../assets/options/gateau-basic.webp";
import gateauChocolate from "../assets/options/gateau-onchocolate.webp";
import gateauVanilla from "../assets/options/gateau-vanilla.webp";
import cup6Basic from "../assets/options/cupcake-6-basic.webp";
import cup6Vanilla from "../assets/options/cupcake-6-vanilla.webp";
import cup6Chocolate from "../assets/options/cupcake-6-chocolate.webp";
import cup12Basic from "../assets/options/cupcake-12-basic.webp";
import cup12Vanilla from "../assets/options/cupcake-12-vanilla.webp";
import cup12Chocolate from "../assets/options/cupcake-12-chocolate.webp";
import {
  MochiBuilder,
  MochiReselectionNotice,
} from "../components/MochiBuilder";
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
  MOCHI_FLAVOURS,
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
      ? `${
          line.selection.mode === "gift-four"
            ? (ko ? "박스당 구성: " : "Per box: ") +
              MOCHI_FLAVOURS.filter((f) => line.selection.flavourCounts![f.id])
                .map(
                  (f) =>
                    `${ko ? f.ko : f.en} ${line.selection.flavourCounts![f.id]}`,
                )
                .join(", ")
            : ko
              ? "단품"
              : "Singles"
        } · ${ko ? "맛별 총수량: " : "Flavour totals: "}${line.flavourTotals
          .map((n, i) =>
            n ? `${ko ? MOCHI_FLAVOURS[i].ko : MOCHI_FLAVOURS[i].en} ${n}` : "",
          )
          .filter(Boolean)
          .join(", ")}`
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
function cardPrice(card: RenewalCard, ko = false) {
  if (card.id === "mochi")
    return ko ? "개당 AUD 8.00부터" : "From AUD 8.00 each";
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
    <main className="renewal-page renewal-collection">
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
                <ProductPhoto label={language === "ko" ? card.ko : card.en} />
              )}
              <h2>{language === "ko" ? card.ko : card.en}</h2>
              <p>{cardPrice(card, language === "ko")}</p>
              {card.id === "brownie-cupcakes" && <p className="renewal-card-note">{t("Reservations awaiting price approval", "가격 승인 후 예약 안내")}</p>}
              {["mochi", "cookies"].includes(card.id) && (
                <p className="renewal-card-note">
                  {t(
                    card.id === "mochi" ? "Pre-orders from 16 October 2026 · subject to manual opening" : "Reservations awaiting price approval",
                    card.id === "mochi" ? "2026년 10월 16일부터 사전예약 · 운영자 수동 개시" : "가격 확정 후 예약 안내",
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
    [addedSelection, setAddedSelection] = useState("");
  const params = new URLSearchParams(window.location.search);
  const initialOffer = card.offers.includes(params.get("offer") || "")
    ? params.get("offer")!
    : card.offers[0];
  const [offerId, setOffer] = useState(initialOffer),
    [size, setSize] = useState(params.get("size") || "6in"),
    [finish, setFinish] = useState(params.get("finish") || "basic"),
    [chocolateType, setChocolate] = useState("dark");
  const [quantity, setQuantity] = useState(1);
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
  const presentation = renewalDetailPresentation(card);
  const p = RENEWAL_OFFERS[offerId],
    isCup = p.family === "cupcake";
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
        quantity,
        finish,
        individualPackaging: false,
        ...(p.sizes ? { size } : {}),
        ...(p.chocolate ||
        (offerId === "pound-cake" && finish === "extra-chocolate")
          ? { chocolateType }
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
  const selectionKey = JSON.stringify(selection);
  const added = addedSelection === selectionKey;
  function finishImage(id: string, f: string) {
    const images: Record<string, Record<string, string>> = {
      "pound-cake": {
        basic: gateauBasic,
        "extra-chocolate": gateauChocolate,
        "vanilla-fresh-cream": gateauVanilla,
      },
      "cupcake-half-dozen": {
        basic: cup6Basic,
        "vanilla-fresh-cream": cup6Vanilla,
        "chocolate-buttercream": cup6Chocolate,
      },
      "cupcake-dozen": {
        basic: cup12Basic,
        "vanilla-fresh-cream": cup12Vanilla,
        "chocolate-buttercream": cup12Chocolate,
      },
    };
    return images[id]?.[f];
  }
  const extras = [
    {
      id: "addon-pave",
      en: "Pavé Chocolate · 100g",
      ko: "파베 초콜릿 · 100g",
      image: "/products/chocolates/pave-heart-100g.png",
    },
    {
      id: "addon-cream",
      en: "Vanilla Cream Box · 100g",
      ko: "생크림 박스 · 100g",
      image: "",
    },
    {
      id: "addon-almond",
      en: "Almond Chocolate · 80g",
      ko: "아몬드 초콜릿 · 80g",
      image: "/products/chocolates/almond-chocoball.webp",
    },
    {
      id: "addon-eiffel",
      en: "Eiffel Tower · 6 pieces",
      ko: "에펠탑 · 6피스",
      image: "/products/chocolates/eiffel-tower-chocolate.webp",
    },
  ];
  const packLabel = (id: string) => {
    const o = RENEWAL_OFFERS[id];
    if (o.bundle) return t("5 + 1 packs", "5 + 1팩");
    if (id.includes("black-tub"))
      return t("Black tub · 2 × 80g", "블랙 통 · 80g × 2");
    if (id.includes("80g")) return "80g";
    if (id.includes("100g")) return t("Heart tin · 100g", "하트 통 · 100g");
    return `${o.pieces}${t(" pieces", "개")}`;
  };
  function add() {
    try {
      const ids = new Map(
        selection.map((l) => [l.lineId, crypto.randomUUID()]),
      );
      const next = selection.map((l) => ({
        ...l,
        lineId: ids.get(l.lineId)!,
        ...(l.parentLineId ? { parentLineId: ids.get(l.parentLineId)! } : {}),
      }));
      priceRenewalOrder(next, { localPreview });
      addRenewalLines(cart.renewalLines, next);
      cart.addRenewal(next);
      setAddedSelection(selectionKey);
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
    <main className="renewal-page renewal-detail au-product-detail">
      <div className="au-pave-hero">
        <div className="renewal-product-media">
          {card.id === "pave" ? (
            <AuPaveGallery />
          ) : presentation ? (
            <AuDetailGallery key={card.id} presentation={presentation} />
          ) : (
            <ProductPhoto src={card.image} label={ko ? card.ko : card.en} />
          )}
        </div>
        <section className="renewal-options au-pave-purchase">
          <a
            href={
              p.family === "cupcake" || p.family === "smore"
                ? "/celebrate"
                : !p.family
                  ? "/chocolates"
                  : "/cakes"
            }
          >
            {t("Back to collection", "상품 목록")}
          </a>
          <header>
            <h1>{ko ? card.ko : card.en}</h1>
            <p>
              {t(
                "Made to order. Availability is confirmed after your request.",
                "주문 제작 상품입니다. 신청 후 가능 여부를 확인해드립니다.",
              )}
            </p>
          </header>
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
            <fieldset className="au-pave-fieldset">
              <legend>{t("Choose your pack", "구성 선택")}</legend>
              <div className="renewal-option-grid">
                {card.offers.map((id) => (
                  <OptionButton
                    key={id}
                    active={offerId === id}
                    onClick={() => {
                      setOffer(id);
                      setFinish("basic");
                    }}
                  >
                    <ProductPhoto option src={id === card.offers[0] ? card.image : undefined} label={packLabel(id)} />
                    <strong>{packLabel(id)}</strong>
                    <span className="au-pave-option-price">
                      {money(RENEWAL_OFFERS[id].price!)}
                    </span>
                  </OptionButton>
                ))}
              </div>
            </fieldset>
          )}
          {p.sizes && (
            <fieldset className="au-pave-fieldset">
              <legend>{t("Choose your size", "사이즈 선택")}</legend>
              <div className="au-pave-size-options">
                {Object.keys(p.sizes).map((s) => {
                  const serving =
                    offerId === "pave-cake"
                      ? formatCurrentCakeSizeLabel("pave-cake", s as "6in")
                          ?.split("|")[1]
                          ?.trim()
                      : null;
                  return (
                    <OptionButton
                      key={s}
                      active={size === s}
                      onClick={() => setSize(s)}
                    >
                      <strong>{s.replace("in", "″")}</strong>
                      {serving && (
                        <span>
                          {ko
                            ? serving.replace("serves approx.", "약") + "인분"
                            : serving}
                        </span>
                      )}
                      <span className="au-pave-option-price">
                        {money(p.sizes![s])}
                      </span>
                    </OptionButton>
                  );
                })}
              </div>
            </fieldset>
          )}
          {isCup ? (
            card.offers.map((id) => {
              const offer = RENEWAL_OFFERS[id],
                pack = packs[id];
              return (
                <fieldset
                  key={id}
                  className={`au-pave-fieldset renewal-cup-pack${pack.quantity ? " is-selected" : ""}`}
                >
                  <legend>
                    {offer.pieces}
                    {t(" cupcakes per box", "개 / 박스")}
                  </legend>
                  <div className="renewal-option-grid">
                    {Object.entries(offer.finishes!).map(([f, cents]) => (
                      <OptionButton
                        key={f}
                        active={pack.finish === f}
                        onClick={() =>
                          setPacks({ ...packs, [id]: { ...pack, finish: f } })
                        }
                      >
                        <ProductPhoto
                          option
                          src={finishImage(id, f)}
                          label={labelFinish(f, ko)}
                        />
                        <strong>{labelFinish(f, ko)}</strong>
                        <span className="au-pave-option-price">
                          {!offer.provisional || localPreview
                            ? money(cents)
                            : t("Price awaiting approval", "가격 승인 대기")}
                        </span>
                        <span>
                          {f !== "basic" && (!offer.provisional || localPreview)
                            ? `+ ${money(cents - offer.finishes!.basic)}`
                            : t("Included", "기본 구성")}
                        </span>
                      </OptionButton>
                    ))}
                  </div>
                  <QuantityStepper
                    label={`${offer.pieces}${t("-piece boxes", "개 박스 수")}`}
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
                  <OptionButton
                    active={pack.packaging}
                    onClick={() =>
                      setPacks({
                        ...packs,
                        [id]: { ...pack, packaging: !pack.packaging },
                      })
                    }
                  >
                    <strong>{t("Individual packaging", "개별포장")}</strong>
                    <span>
                      {t("AUD 0.50 per cupcake", "컵케이크 개당 AUD 0.50")}
                    </span>
                  </OptionButton>
                </fieldset>
              );
            })
          ) : (
            <>
              {(p.finishes || p.cream) && (
                <fieldset className="au-pave-fieldset">
                  <legend>{t("Choose your finish", "토핑 선택")}</legend>
                  <div className="renewal-option-grid">
                    {Object.keys(
                      p.finishes || { basic: 0, "vanilla-fresh-cream": 1000 },
                    ).map((f) => {
                      const delta = p.cream
                        ? f === "basic"
                          ? 0
                          : 1000
                        : p.finishes![f] - p.finishes!.basic;
                      return (
                        <OptionButton
                          key={f}
                          active={finish === f}
                          onClick={() => setFinish(f)}
                        >
                          <ProductPhoto
                            option
                            src={finishImage(offerId, f)}
                            label={labelFinish(f, ko)}
                          />
                          <strong>{labelFinish(f, ko)}</strong>
                          <span className="au-pave-option-price">
                            {delta
                              ? `+ ${money(delta)}`
                              : t("Included", "기본 구성")}
                          </span>
                        </OptionButton>
                      );
                    })}
                  </div>
                </fieldset>
              )}
              {(p.chocolate ||
                (offerId === "pound-cake" && finish === "extra-chocolate")) && (
                <fieldset className="au-pave-fieldset">
                  <legend>{t("Chocolate", "초콜릿")}</legend>
                  <div className="renewal-option-grid">
                    {["dark", "milk"].map((c) => (
                      <OptionButton
                        key={c}
                        active={chocolateType === c}
                        onClick={() => setChocolate(c)}
                      >
                        <strong>
                          {c === "dark" ? t("Dark", "다크") : t("Milk", "밀크")}
                        </strong>
                      </OptionButton>
                    ))}
                  </div>
                </fieldset>
              )}
              {card.id === "cookies" && (
                <p>
                  {t(
                    "6 cookies per box · 3 Chocolate Chip + 3 Double Chocolate.",
                    "6개 세트 · 초코칩 3개 + 더블초코 3개.",
                  )}
                </p>
              )}
              <QuantityStepper
                label={t("Quantity", "수량")}
                min={1}
                value={quantity}
                onChange={setQuantity}
              />
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
            <fieldset className="au-pave-fieldset">
              <legend>
                {t(
                  "Add something extra · 5% off",
                  "함께 담는 추가상품 · 5% 할인",
                )}
              </legend>
              <div className="renewal-extras-grid">
                {extras.map((extra) => {
                  const n = addons[extra.id] || 0,
                    name = ko ? extra.ko : extra.en;
                  const extraQuote = priceRenewalOrder(
                    [
                      {
                        lineId: "preview-0",
                        offerId,
                        quantity: 1,
                        ...(p.sizes ? { size: Object.keys(p.sizes)[0] } : {}),
                      },
                      {
                        lineId: "extra-price",
                        offerId: extra.id,
                        quantity: 1,
                        parentLineId: "preview-0",
                      },
                    ],
                    { localPreview },
                  );
                  const cents = extraQuote.lines[1].totalPriceCents;
                  return (
                    <div
                      key={extra.id}
                      data-extra={extra.id}
                      className={`renewal-extra-card${n ? " is-selected" : ""}`}
                    >
                      <ProductPhoto option src={extra.image} label={name} />
                      <strong>{name}</strong>
                      <span>{money(cents)}</span>
                      <QuantityStepper
                        label={name}
                        value={n}
                        onChange={(v) =>
                          setAddons({ ...addons, [extra.id]: v })
                        }
                      />
                    </div>
                  );
                })}
              </div>
            </fieldset>
          )}
          {quote && (
            <div className="renewal-total" aria-live="polite">
              <p>
                {t("Product subtotal", "상품 소계")}{" "}
                {money(quote.subtotalCents)}
              </p>
              {quote.discountCents > 0 && (
                <p>
                  {t("Extra savings", "추가상품 할인")} −
                  {money(quote.discountCents)}
                </p>
              )}
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
          {!quote && (
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
          <button
            className="au-pave-order-button"
            type="button"
            disabled={!quote}
            onClick={add}
          >
            {t("Add to bag", "장바구니에 담기")}
          </button>
          {added && (
            <p role="status">
              {t("Added to your bag.", "장바구니에 담았습니다.")}{" "}
              <a href="/cart">{t("View bag", "장바구니 보기")}</a>
            </p>
          )}
          <AuPickupNotice language={language} driver />
          {p.newProduct && (
            <p>
              {t(
                "Reservations will open after the sale price is approved. Please allow at least 24 hours before collection.",
                "판매가 확정 후 예약 접수를 엽니다. 픽업까지 최소 24시간이 필요합니다.",
              )}
            </p>
          )}
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
      </div>
      <PurchaseBar
        total={
          quote ? money(quote.totalPriceCents) : t("Enquire", "문의해주세요")
        }
        disabled={!quote}
        onAdd={add}
        added={added}
      />
      <AuRenewalProductStory card={card} language={language} />
    </main>
  );
}

function MochiProduct({ card }: { card: RenewalCard }) {
  const { t, language } = useAuLanguage(),
    cart = useCart();
  return (
    <main className="renewal-page renewal-detail au-product-detail">
      <a href="/chocolates">{t("Back to collection", "상품 목록")}</a>
      <MochiReselectionNotice />
      <div className="au-pave-hero">
        <div className="renewal-product-media">
          <ProductPhoto
            src={card.image}
            label={language === "ko" ? card.ko : card.en}
          />
        </div>
        <section className="au-pave-purchase">
          <h1>{language === "ko" ? card.ko : card.en}</h1>
          <p>
            {t(
              "Choose from six flavours · From AUD 8.00 each",
              "6가지 맛 선택 · 개당 AUD 8.00부터",
            )}
          </p>
          <p>
            {t(
              "Pre-orders from 16 October 2026, subject to readiness checks and manual opening. Please allow at least 24 hours before collection.",
              "2026년 10월 16일부터 준비 확인 후 운영자가 예약 접수를 엽니다. 픽업까지 최소 24시간이 필요합니다.",
            )}
          </p>
          <div className="mochi-product-information">
            <p>{t("Original: 80g. Fruit and butter & red bean: at least 85g each; fruit weight varies.", "오리지널 80g. 과일·앙버터는 개당 85g 이상이며 과일 상태에 따라 중량이 달라집니다.")}</p>
            <p>{t("Keep refrigerated. Best enjoyed on the day. Recommended refrigerated storage: up to 3 days.", "냉장 보관해주세요. 당일 섭취를 권장하며, 냉장 보관은 최대 3일 권장합니다.")}</p>
                      <p>{t("Contains milk and soy. Made in a facility that also handles almonds, wheat, eggs, sesame and peanuts.", "우유·대두 함유. 아몬드·밀·계란·참깨·땅콩을 취급하는 시설에서 함께 제조합니다.")}</p>
          </div>
          <MochiBuilder
            sticky
            onSave={(lines) => {
              const next = lines.map((l) => ({
                ...l,
                lineId: crypto.randomUUID(),
              }));
              addRenewalLines(cart.renewalLines, next);
              cart.addRenewal(next);
            }}
          />
          <AuPickupNotice language={language} driver />
          <p>
            {t(
              "Please contact us about ingredients and allergies before ordering.",
              "원재료와 알레르기는 주문 전 문의해주세요.",
            )}
          </p>
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
    [resultPickup, setResultPickup] = useState(""),
    [editingMochi, setEditingMochi] = useState<string | null>(null);
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
    if (lock.current || editingMochi !== null) return;
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
    <main className="renewal-page renewal-cart">
      <h1>{t("Your bag", "장바구니")}</h1>
      <MochiReselectionNotice />
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
  if (card?.id === "mochi") return <MochiProduct card={card} />;
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
