// Approved general AU pickup hours. New-order activation remains a separate runtime decision.
export const RENEWAL_PICKUP_POLICY_VERSION = "au-renewal-pickup.2026-10-14.v2";
export const RENEWAL_PICKUP_SCHEDULE = Object.freeze({
  timezone: "Australia/Sydney",
  intervalMinutes: 15,
  weekdays: Object.freeze({
    0: Object.freeze({ open: "09:00", close: "12:00" }),
    3: Object.freeze({ open: "09:00", close: "16:00" }),
    5: Object.freeze({ open: "09:00", close: "16:00" }),
    6: Object.freeze({ open: "09:00", close: "12:00" }),
  }),
});
export function renewalServiceSlots(
  date,
  { closedDates = [], closedIntervals = {} } = {},
) {
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return [];
  const value = new Date(`${date}T00:00:00Z`);
  if (
    !Number.isFinite(value.getTime()) ||
    value.toISOString().slice(0, 10) !== date ||
    closedDates.includes(date)
  )
    return [];
  const hours = RENEWAL_PICKUP_SCHEDULE.weekdays[value.getUTCDay()];
  if (!hours) return [];
  const minutes = (time) =>
    Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
  const slots = [];
  for (
    let n = minutes(hours.open);
    n <= minutes(hours.close);
    n += RENEWAL_PICKUP_SCHEDULE.intervalMinutes
  ) {
    const time = `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
    if (
      !(closedIntervals[date] || []).some(
        (i) => time >= i.start && time < i.end,
      )
    )
      slots.push(time);
  }
  return slots;
}
export function isRenewalServiceTime(date, time, policy = {}) {
  return (
    typeof time === "string" && renewalServiceSlots(date, policy).includes(time)
  );
}
export function renewalPickupCopy(language = "en") {
  const days = Object.keys(RENEWAL_PICKUP_SCHEDULE.weekdays).map(Number);
  const names =
    language === "ko"
      ? ["일", "월", "화", "수", "목", "금", "토"]
      : [
          "Sunday",
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
        ];
  const group = (selected) =>
    selected
      .filter((day) => days.includes(day))
      .map((day) => names[day])
      .join(language === "ko" ? "·" : " & ");
  const weekday = RENEWAL_PICKUP_SCHEDULE.weekdays[3],
    weekend = RENEWAL_PICKUP_SCHEDULE.weekdays[6];
  return language === "ko"
    ? {
        hours: `시드니 시간 ${group([3, 5])} ${weekday.open}–${weekday.close} · ${group([6, 0])} ${weekend.open}–${weekend.close}. 월·화·목은 일반 픽업이 없습니다.`,
        driver:
          "Uber·DiDi 등 고객이 준비한 차량으로 수령할 수 있습니다. 미리 연락해 인계 시간을 조율해주세요. 일반 픽업 시간 외 인계는 운영자의 사전 승인이 필요하며 온라인에서 임의로 선택할 수 없습니다. 배차와 비용은 고객님이 준비합니다.",
      }
    : {
        hours: `Sydney time: ${group([3, 5])} ${weekday.open}–${weekday.close} · ${group([6, 0])} ${weekend.open}–${weekend.close}. No general pickup on Monday, Tuesday or Thursday.`,
        driver:
          "You may arrange an Uber, DiDi or another driver to collect your order. Please contact us in advance to agree on the handover time. Handover outside general pickup hours requires prior operator approval and cannot be selected online. You arrange and pay for the driver.",
      };
}
