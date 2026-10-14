import { renewalPickupCopy } from "../../appwrite-functions/reservation-api/src/au-renewal-pickup-policy.js";
import type { Language } from "../lib/i18n";
export function AuPickupNotice({
  language,
  driver = false,
}: {
  language: Language;
  driver?: boolean;
}) {
  const copy = renewalPickupCopy(language);
  return (
    <div className="au-pickup-notice">
      <p>{copy.hours}</p>
      {driver && <p>{copy.driver}</p>}
    </div>
  );
}
