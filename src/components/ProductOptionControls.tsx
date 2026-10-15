import type { ReactNode } from "react";
import { useAuLanguage } from "../lib/au-language";

/** Same selection semantics and class as the existing Pavé detail. */
export function OptionButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`cake-detail-option${active ? " is-selected" : ""}`}
      aria-pressed={active}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
export function QuantityStepper({
  label,
  value,
  onChange,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
}) {
  const { t } = useAuLanguage();
  return (
    <div className="renewal-stepper-field">
      <span>{label}</span>
      <div className="au-pave-quantity" role="group" aria-label={label}>
        <button
          type="button"
          aria-label={`${label} ${t("decrease", "줄이기")}`}
          disabled={value <= min}
          onClick={() => onChange(value - 1)}
        >
          −
        </button>
        <output aria-label={label} aria-live="polite">
          {value}
        </output>
        <button
          type="button"
          aria-label={`${label} ${t("increase", "늘리기")}`}
          disabled={value >= max}
          onClick={() => onChange(value + 1)}
        >
          +
        </button>
      </div>
    </div>
  );
}
export function ProductPhoto({
  src,
  label,
  option = false,
}: {
  src?: string;
  label: string;
  option?: boolean;
}) {
  const { t } = useAuLanguage();
  return (
    <div className={option ? "renewal-option-photo" : "renewal-product-photo"}>
      {src ? (
        <img src={src} alt={label} loading={option ? "lazy" : "eager"} />
      ) : (
        <div
          className="renewal-photo-slot"
          role="img"
          aria-label={`${label} · ${t("Photo coming soon", "사진 준비 중")}`}
        >
          <span>{t("Photo coming soon", "사진 준비 중")}</span>
        </div>
      )}
    </div>
  );
}
export function PurchaseBar({
  total,
  disabled,
  onAdd,
  added = false,
}: {
  total: string;
  disabled: boolean;
  onAdd: () => void;
  added?: boolean;
}) {
  const { t } = useAuLanguage();
  return (
    <div className="au-pave-sticky-order">
      <div>
        <span>{t("Order total", "주문 합계")}</span>
        <strong aria-live="polite">{total}</strong>
      </div>
      <button
        type="button"
        className="au-pave-order-button"
        disabled={disabled}
        onClick={onAdd}
      >
        {t("Add to bag", "장바구니에 담기")}
      </button>
      {added && (
        <a className="au-pave-view-order" href="/cart">
          {t("View bag", "장바구니 보기")}
        </a>
      )}
    </div>
  );
}
