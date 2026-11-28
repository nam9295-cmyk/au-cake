import { formatAudCents } from "../lib/utils";
import { useHalloweenAvailability } from '../lib/use-halloween-availability';
import { MOCHI_PUBLIC_INFORMATION } from '../../appwrite-functions/reservation-api/src/au-renewal-seo.js';
import { renewalPhoto, renewalPhotos } from "../lib/renewal-photos";
import { RenewalPhotoGallery, SixPackPhoto } from "../components/RenewalPhotoStory";
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
import { AuServiceLandingPage } from './AuServiceLandingPage';
import { getCakeEditorialBySlug } from "../lib/cake-editorial";
import { useEffect, useState } from "react";
import { useCart } from "../CartProvider";
import { useAuLanguage } from "../lib/au-language";
import {
  RENEWAL_CARDS,
  HALLOWEEN_MERINGUE_CARD,
  halloweenMeringueAvailable,
  isHalloweenMeringue,
  RENEWAL_NAV,
  renewalCardForPath,
  type RenewalCard,
} from "../../appwrite-functions/reservation-api/src/au-renewal-catalog.js";
import {
  ALMOND_GIFT_BOX_ID,
  almondGiftBoxPriceCents,
  RENEWAL_OFFERS,
  renewalFinishName,
  renewalSizeName,
  wholeCakeToppingSurchargeCents,
  priceRenewalOrder,
  type RenewalSelection,
} from "../../appwrite-functions/reservation-api/src/au-renewal.js";
import { useAlmondGiftSale } from "../lib/use-almond-gift-sale";
import { almondPacks } from "../lib/almond-packs";
import { addRenewalLines } from "../lib/renewal-cart";
const localPreview = import.meta.env.DEV;
const labelFinish = (f: string, ko: boolean) => renewalFinishName(f, ko ? "ko" : "en");
declare const __AU_JOURNAL_LINKS__: Record<string, { href: string; label: string }[]>;

function RelatedJournal({ path }: { path: string }) {
  const { t } = useAuLanguage();
  const links = typeof __AU_JOURNAL_LINKS__ === "undefined" ? undefined : __AU_JOURNAL_LINKS__[path];
  if (!links?.length) return null;
  return (
    <section className="au-related-reading">
      <h2>{t("Related Journal", "관련 저널")}</h2>
      <ul>{links.map(link => <li key={link.href}><a href={link.href}>{link.label}</a></li>)}</ul>
    </section>
  );
}

function cardPrice(card: RenewalCard, ko = false) {
  if (card.id === "mochi")
    return ko ? "개당 AUD 8.00부터" : "From AUD 8.00 each";
  const p = RENEWAL_OFFERS[card.offers[0]];
  return p.price === null || (p.provisional && !localPreview)
    ? ""
    : `${p.sizes ? (ko ? "기본가 " : "From ") : ""}${formatAudCents(p.price)}`;
}
export function RenewalCollection({
  category,
}: {
  category: keyof typeof RENEWAL_CARDS;
}) {
  const { language, t } = useAuLanguage();
  const seasonalAvailable = useHalloweenAvailability();
  const cards = category === "cakes" && seasonalAvailable
    ? [HALLOWEEN_MERINGUE_CARD, ...RENEWAL_CARDS[category]] : RENEWAL_CARDS[category];
  return (
    <main className="renewal-page renewal-collection">
      <h1>{RENEWAL_NAV.find((n) => n.href === `/${category}`)?.en}</h1>
      <div className="renewal-grid">
        {cards.map((card) => (
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
              <p className="au-mobile-price">{cardPrice(card, language === "ko")}</p>
              {card.id === "halloween-meringue" && <p className="renewal-card-note">{t("Halloween special · Final pickup 1 November · 24 hours notice", "할로윈 한정 · 11월 1일까지 픽업 · 최소 24시간 전 주문")}</p>}
              {card.id === "brownie-cupcakes" && <p className="renewal-card-note">{t("Reservations awaiting price approval", "가격 승인 후 예약 안내")}</p>}
              {["mochi", "cookies"].includes(card.id) && (
                <p className="renewal-card-note">
                  {t(
                    card.id === "mochi" ? "Please allow at least 24 hours before pickup" : "Reservations awaiting price approval",
                    card.id === "mochi" ? "픽업까지 최소 24시간이 필요합니다" : "가격 확정 후 예약 안내",
                  )}
                </p>
              )}
            </a>
          </article>
        ))}
      </div>
      <RelatedJournal path={`/${category}`} />
    </main>
  );
}
function AlmondPackPhoto({ id, language, option = false }: { id: string; language: "en" | "ko"; option?: boolean }) {
  const pack = almondPacks[id];
  if (pack.sixPack) return <SixPackPhoto src={pack.image} label={pack[language]} />;
  const src = pack.thumbnail ?? pack.image;
  return <ProductPhoto src={src} label={pack[language]} option={option}
    srcSet={pack.thumbnail && !option ? `${src} 480w, ${pack.image} 960w` : undefined}
    sizes={pack.thumbnail && !option ? "(max-width: 767px) 100vw, (max-width: 1099px) calc(100vw - 64px), 50vw" : undefined} />;
}

function packFromUrl(card: RenewalCard, query: URLSearchParams, fallback = card.offers[0]) {
  const requested = query.get("offer") || fallback;
  if (requested === "almond-chocoball-80g" && query.get("almondPackaging") === "triangle-box" && card.id === "almond")
    return "almond-triangle-60g";
  return card.offers.includes(requested) ? requested : card.offers[0];
}

function Product({ card }: { card: RenewalCard }) {
  const { language, t } = useAuLanguage(),
    ko = language === "ko";
  const seasonalAvailable = useHalloweenAvailability();
  const almondSale = useAlmondGiftSale();
  const seasonal = card.id === "halloween-meringue";
  const seasonalClosed = seasonal && !seasonalAvailable;
  const cart = useCart(),
    [error, setError] = useState(""),
    [addedSelection, setAddedSelection] = useState("");
  const params = new URLSearchParams(window.location.search);
  const editId = params.get("edit");
  const retiredAlmond = card.id === "almond" && cart.almondReselectionLines.find(line => line.lineId === editId);
  const editLine = cart.renewalLines.find(line => line.lineId === editId && card.offers.includes(line.offerId));
  const initialOffer = editLine?.offerId || packFromUrl(card, params, retiredAlmond ? "almond-triangle-60g" : card.offers[0]);
  const [offerId, setOffer] = useState(initialOffer),
    [size, setSize] = useState(params.get("size") || editLine?.size || (RENEWAL_OFFERS[initialOffer].sizes ? Object.keys(RENEWAL_OFFERS[initialOffer].sizes!)[0] : "6in")),
    [finish, setFinish] = useState(params.get("finish") || editLine?.finish || "basic"),
    [chocolateType, setChocolate] = useState(params.get("chocolateType") || editLine?.chocolateType || "dark");
  const [quantity, setQuantity] = useState(() => { const n = Number(params.get("quantity") || editLine?.quantity || 1); return Number.isSafeInteger(n) && n > 0 && n <= 5 ? n : 1; });
  const [chocolateIcingCount, setChocolateIcingCount] = useState(0);
  const [lemonPackaging, setLemonPackaging] = useState(false);
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
  const [addons, setAddons] = useState<Record<string, number>>(() => Object.fromEntries(cart.renewalLines.filter(line => line.parentLineId === editId).map(line => [line.offerId, line.quantity])));
  const editorial = getCakeEditorialBySlug(
    card.href.split("?")[0].split("/").at(-1)!,
    language,
  );
  const presentation = renewalDetailPresentation(card, size, finish);
  const p = RENEWAL_OFFERS[offerId],
    isCup = p.family === "cupcake";
  const wholeCake = ["pave-cake", "brownie-whole"].includes(offerId);
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("offer", offerId);
    if (p.sizes) url.searchParams.set("size", size);
    else url.searchParams.delete("size");
    url.searchParams.set("finish", finish);
    if (p.chocolate || (offerId === "pound-cake" && finish === "extra-chocolate")) url.searchParams.set("chocolateType", chocolateType);
    else url.searchParams.delete("chocolateType");
    url.searchParams.delete("almondPackaging");
    url.searchParams.set("quantity", String(quantity));
    window.history.replaceState(window.history.state, "", url);
  }, [offerId, size, finish, p.sizes, p.chocolate, chocolateType, quantity]);
  useEffect(() => {
    const restore = () => {
      const query = new URLSearchParams(window.location.search);
      const id = packFromUrl(card, query, initialOffer);
      setOffer(id);
      setSize(query.get("size") || Object.keys(RENEWAL_OFFERS[id].sizes || {})[0] || "6in");
      setFinish(query.get("finish") || "basic");
      setChocolate(query.get("chocolateType") || "dark");
      const n = Number(query.get("quantity") || 1);
      setQuantity(Number.isSafeInteger(n) && n > 0 && n <= 5 ? n : 1);
    };
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, [card, initialOffer]);
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
        individualPackaging: p.family === "lemon" && lemonPackaging,
        ...(p.family === "lemon" ? { chocolateIcingCount } : {}),
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
    const photos = renewalPhotos(id === "brownie-loaf" ? id : id.startsWith("brownie-cupcakes-") ? "brownie-cupcakes" : "");
    if (photos.length) return renewalPhoto(photos[f === "basic" ? 0 : 2]);
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
      image: renewalPhoto("extra-pave"),
    },
    {
      id: "addon-cream",
      en: "Vanilla Cream Box · 100g",
      ko: "생크림 박스 · 100g",
      image: renewalPhoto("extra-cream"),
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
    if (almondPacks[id]) return almondPacks[id][language];
    if (isHalloweenMeringue(id)) return ({3: t("Taster · 3 pieces", "맛보기 · 3개"), 6: t("Half dozen · 6 pieces", "하프더즌 · 6개"), 12: t("Dozen · 12 pieces", "더즌 · 12개"), 24: t("Double dozen · 24 pieces", "더블더즌 · 24개")} as Record<number, string>)[o.pieces];
    if (o.bundle) return t("5 + 1 packs", "5 + 1팩");
    if (id.includes("100g")) return t("Heart tin · 100g", "하트 통 · 100g");
    return `${o.pieces}${t(" pieces", "개")}`;
  };
  function add() {
    if (seasonal && !halloweenMeringueAvailable()) {
      setError(t("Seasonal orders have closed. Existing reservations are unchanged.", "시즌 주문이 마감되었습니다. 기존 예약은 유지됩니다."));
      return;
    }
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
      if (editId) {
        if (!editLine && !retiredAlmond) throw new Error("CART_ITEM_CHANGED");
        cart.replaceRenewal(editId, next);
        window.location.replace("/cart");
        return;
      } else {
        addRenewalLines(cart.renewalLines, next);
        cart.addRenewal(next);
      }
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
            <AuPaveGallery key={`${size}-${finish}`} mini={size === "4in"} strawberries={finish === "fresh-strawberries"} />
          ) : renewalPhotos(card.id).length ? (
            <RenewalPhotoGallery id={card.id} title={ko ? card.ko : card.en} />
          ) : presentation ? (
            <AuDetailGallery key={`${card.id}-${offerId}-${size}-${finish}`} presentation={presentation}
              coverRole={offerId === ALMOND_GIFT_BOX_ID ? "gift-set" : undefined}
              cover={card.id === "almond" && <AlmondPackPhoto id={offerId} language={language} />} />
          ) : (
            <ProductPhoto src={card.image} label={ko ? card.ko : card.en} />
          )}
        </div>
        <section className="renewal-options au-pave-purchase">
          <a
            href={
              p.family === "cupcake" || p.family === "smore" || p.family === "lemon"
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
          {seasonal && <div className="renewal-seasonal-note" role="status">
            <p>{seasonalClosed ? t("Seasonal orders have closed. Existing reservations are unchanged.", "시즌 주문이 마감되었습니다. 기존 예약은 유지됩니다.") : t("Halloween special · Final pickup Sunday 1 November 2026", "할로윈 한정 · 마지막 픽업 2026년 11월 1일 일요일")}</p>
            <p>{t("Order at least 24 hours before pickup. Final orders: Saturday 31 October, 1pm (Sydney).", "픽업 최소 24시간 전에 주문해주세요. 최종 마감: 10월 31일 토요일 오후 1시 (시드니).")}</p>
          </div>}
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
              <div className={`renewal-option-grid${seasonal ? " renewal-meringue-options" : ""}`}>
                {card.offers.map((id) => (
                  <OptionButton
                    key={id}
                    active={offerId === id}
                    onClick={() => {
                      setOffer(id);
                      setFinish("basic");
                      setChocolateIcingCount(0);
                    }}
                  >
                    {card.id === "almond" ? <AlmondPackPhoto id={id} language={language} option /> : seasonal ? null : ["pave-six-plus-one", "eiffel-six-plus-one"].includes(id) ? (
                      <SixPackPhoto src={card.image} label={packLabel(id)} />
                    ) : (
                      <ProductPhoto option src={p.family === "lemon" || id === card.offers[0] || id === "smore-12" ? card.image : undefined} label={packLabel(id)} />
                    )}
                    <strong>{packLabel(id)}</strong>
                    <span className="au-pave-option-price">
                      {id === ALMOND_GIFT_BOX_ID && almondSale && <del>{formatAudCents(RENEWAL_OFFERS[id].price!)}</del>}
                      {formatAudCents(id === ALMOND_GIFT_BOX_ID ? almondGiftBoxPriceCents() : RENEWAL_OFFERS[id].price!)}
                    </span>
                    {id === ALMOND_GIFT_BOX_ID && almondSale && <span className="renewal-almond-sale">{t("20% off through 6 Dec", "12월 6일까지 20% 할인")}</span>}
                    {seasonal && <span className="renewal-per-piece">{formatAudCents(RENEWAL_OFFERS[id].price! / RENEWAL_OFFERS[id].pieces)}{t(" each", " / 개")}</span>}
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
                      <strong>{renewalSizeName(s, language)}</strong>
                      {serving && (
                        <span>
                          {ko
                            ? serving.replace("serves approx.", "약") + "인분"
                            : serving}
                        </span>
                      )}
                      <span className="au-pave-option-price">
                        {formatAudCents(p.sizes![s])}
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
                            ? formatAudCents(cents)
                            : t("Price awaiting approval", "가격 승인 대기")}
                        </span>
                        <span>
                          {f !== "basic" && (!offer.provisional || localPreview)
                            ? `+ ${formatAudCents(cents - offer.finishes!.basic)}`
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
              {p.family === "lemon" && <fieldset className="au-pave-fieldset">
                <legend>{t("Choose your finish", "마감 선택")}</legend>
                <p>{t("Fresh lemon zest icing included. Dark couverture chocolate: +AUD 0.50 per piece.", "생레몬 제스트 아이싱 기본 포함 · 다크 커버춰 초콜릿 개당 AUD 0.50 추가")}</p>
                <QuantityStepper label={t("Dark chocolate pieces per box", "박스당 초콜릿 마감 개수")} value={chocolateIcingCount} min={0} max={p.pieces} onChange={setChocolateIcingCount} />
                <p>{t("Lemon icing", "레몬 아이싱")} {p.pieces-chocolateIcingCount} · {t("Dark chocolate", "다크 초콜릿")} {chocolateIcingCount}</p>
                <OptionButton active={lemonPackaging} onClick={()=>setLemonPackaging(!lemonPackaging)}>
                  <strong>{t("Individual packaging", "개별포장")}</strong>
                  <span>{t("AUD 0.50 per piece · Free from AUD 100 of individually packaged cupcakes and lemon cakes", "개당 AUD 0.50 · 개별포장 컵케이크·레몬케이크 상품금액 AUD 100 이상 무료")}</span>
                </OptionButton>
              </fieldset>}
              {(wholeCake || p.finishes || p.cream) && (
                <fieldset className="au-pave-fieldset">
                  <legend>{t("Choose your finish", "토핑 선택")}</legend>
                  <div className="renewal-option-grid">
                    {Object.keys(
                      wholeCake ? (offerId === "pave-cake" ? { basic: 0, "fresh-strawberries": 0 } : { basic: 0, "vanilla-fresh-cream": 0, "vanilla-fresh-cream-strawberries": 0 }) : p.finishes || { basic: 0, "vanilla-fresh-cream": 1000 },
                    ).map((f) => {
                      const delta = wholeCake ? wholeCakeToppingSurchargeCents(offerId, Object.hasOwn(p.sizes!, size) ? size : "4in", f) : p.cream
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
                          {!wholeCake && <ProductPhoto
                            option
                            src={finishImage(offerId, f)}
                            label={labelFinish(f, ko)}
                          />}
                          <strong>{labelFinish(f, ko)}</strong>
                          <span className="au-pave-option-price">
                            {delta
                              ? `+ ${formatAudCents(delta)}${wholeCake ? t(" per cake", " / 케이크 1개") : ""}`
                              : t("Included", "기본 구성")}
                          </span>
                        </OptionButton>
                      );
                    })}
                  </div>
                </fieldset>
              )}
              {offerId === "pave-cake" && <div className="renewal-dark-chocolate-note">
                <p>{t("Made with dark chocolate.", "다크 초콜릿으로 만듭니다.")}</p>
                {chocolateType === "milk" && <>
                  <p role="alert">{t("Milk chocolate is no longer available. Choose Dark to confirm a new selection.", "밀크 초콜릿 판매가 종료되었습니다. 다크를 직접 선택해 새 구성을 확인해주세요.")}</p>
                  <button type="button" onClick={() => setChocolate("dark")}>{t("Choose Dark", "다크 선택")}</button>
                </>}
              </div>}
              {((p.chocolate && offerId !== "pave-cake") ||
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
                      <span className="au-mobile-price">{formatAudCents(cents)}</span>
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
                <span className="au-mobile-price">{formatAudCents(quote.subtotalCents)}</span>
              </p>
              {quote.discountCents > 0 && (
                <p>
                  {t("Extra savings", "추가상품 할인")} −
                  <span className="au-mobile-price">{formatAudCents(quote.discountCents)}</span>
                </p>
              )}
              <p>
                {t("Packaging", "포장비")}{" "}
                <span className="au-mobile-price">{formatAudCents(quote.individualPackagingFeeCents)}</span>
              </p>
              <strong><span className="au-mobile-price">{formatAudCents(quote.totalPriceCents)}</span></strong>
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
            disabled={!quote || seasonalClosed}
            onClick={add}
          >
            {editId ? t("Update bag", "장바구니 수정") : t("Add to bag", "장바구니에 담기")}
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
        label={editId ? t("Update bag", "장바구니 수정") : undefined}
        total={
          quote ? formatAudCents(quote.totalPriceCents) : t("Enquire", "문의해주세요")
        }
        disabled={!quote || seasonalClosed}
        onAdd={add}
        added={added}
      />
      <AuRenewalProductStory card={card} language={language} />
      <RelatedJournal path={card.href.split("?")[0]} />
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
          <RenewalPhotoGallery id="mochi" title={language === "ko" ? card.ko : card.en} />
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
              "Pre-orders from 16 October 2026. Please allow at least 24 hours before collection.",
              "2026년 10월 16일부터 사전예약을 받습니다. 픽업까지 최소 24시간이 필요합니다.",
            )}
          </p>
          <div className="mochi-product-information">
            {MOCHI_PUBLIC_INFORMATION[language].map(text => <p key={text}>{text}</p>)}
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
      <RelatedJournal path={card.href} />
    </main>
  );
}
function ScopedProduct({card}:{card:RenewalCard}) {
  const cart=useCart(),{t}=useAuLanguage();
  const editId=new URLSearchParams(window.location.search).get('edit');
  if(editId&&!cart.ready)return <main className="renewal-page" role="status">{t('Checking your account…','계정을 확인하고 있습니다…')}</main>;
  return <Product key={editId?`${cart.owner}:${card.id}:${editId}`:card.id} card={card}/>;
}
export default function AuRenewalCatalog({ path }: { path: string }) {
  const { t } = useAuLanguage();
  const category = path.slice(1) as keyof typeof RENEWAL_CARDS;
  if (Object.hasOwn(RENEWAL_CARDS, category))
    return <RenewalCollection category={category} />;
  if (path === '/business' || path === '/custom-cakes')
    return <AuServiceLandingPage kind={path === '/business' ? 'business' : 'custom-cakes'} />;
  const card = renewalCardForPath(path, window.location.search);
  if (card?.id === "mochi") return <MochiProduct card={card} />;
  return card ? (
    <ScopedProduct key={card.id} card={card} />
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
