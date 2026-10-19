import { RENEWAL_PICKUP_POLICY_VERSION } from "../../appwrite-functions/reservation-api/src/au-renewal-pickup-policy.js";
import { executeReservationApi, type CustomerOrderTransport } from "./repository";
import { parseRenewalProjection } from "../../appwrite-functions/reservation-api/src/au-renewal-reader.js";
import { RENEWAL_CONTRACT } from "../../appwrite-functions/reservation-api/src/au-renewal.js";
export async function renewalCapabilities() {
  return executeReservationApi(
    "renewal-health",
    undefined,
    (value: unknown) => {
      const row = value as Record<string, unknown>;
      if (
        !row ||
        row.contractVersion !== RENEWAL_CONTRACT ||
        row.pickupPolicyVersion !== RENEWAL_PICKUP_POLICY_VERSION ||
        ["enabled", "preordersEnabled", "weekendApproved"].some(
          (k) => typeof row[k] !== "boolean",
        )
      )
        throw new Error("RENEWAL_UNAVAILABLE");
      return {
        enabled: row.enabled as boolean,
        preordersEnabled: row.preordersEnabled as boolean,
        weekendApproved: row.weekendApproved as boolean,
      };
    },
  );
}
export async function createRenewalOrder(input: unknown, options?: CustomerOrderTransport) {
  const caps = await renewalCapabilities();
  if (!caps.enabled) throw new Error("RENEWAL_UNAVAILABLE");
  return executeReservationApi("create-cake", input, parseRenewalProjection, options);
}
