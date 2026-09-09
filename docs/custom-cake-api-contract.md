# Custom Cake v1 / Cake Order v2 — approved wire contract

Baseline main: `09b00780efd241ab9727a214579f3621a353a5ec` (PR #11).
This commit is documentation, erased TypeScript types, static fixtures and tests only.
No action is registered, no pricing/discount is activated, no database/storage/mail code changes.
The word “must” below constrains later implementations; it does not claim an endpoint exists.

## 1. Approved policy (not a recommendation)

| Item | Binding rule |
| --- | --- |
| Event window | Actual feature activation time inclusive, before **2026-10-01 00:00 Australia/Sydney** exclusive. End instant is `2026-09-30T14:00:00.000Z`; use IANA zone, not a permanent UTC offset. |
| Eligibility | Server-recorded **first valid persisted receipt time**, `promotionEligibilityAt`. Invalid/failed attempts do not reserve eligibility. Duplicate successful submissions and quote edits retain the original instant; October pickup/edit does not remove September eligibility. |
| Custom discount | 5% of Custom Cake base subtotal only. Each custom line: round(base unit cents × quantity × 5 / 100); aggregate these line discounts. No discount on negotiated extras or paid S’more. |
| Free S’more | 2 per Custom Cake item, only during event. Gift quantity is server-generated fulfillment metadata, not a paid line or customer input. No multiplication on retries/quote edits. |
| Standalone S’more | AUD 4.50 each, no new-order bulk discount. 6/12 cost 2700/5400 cents. |
| Cake Add-on S’more | Valid parent Cake required, 30% regardless of quantity, AUD 3.15 each; permanent and independent of event. 6/12 cost 1890/3780 cents. |
| Bulk removal | New-order 6–11 10% / 12+ 20% abolished at required cutover. Compat is explicitly transitional, not the final policy. Historical stored prices/discounts and exact retries remain unchanged. |
| Coupon stacking | No stacking on a line. Custom event and add-on lines do not receive other coupons. Other existing Cake products keep existing coupon eligibility, validation and allocation. Standalone S’more remains normal price. Custom v1 accepts no coupon field; v2 promo applies only to eligible ordinary Cake lines. |

Custom base unit cents: single `6in=15500`, `8in=20000`, `10in=25000`; double `4in+6in=25500`, `6in+8in=36500`, `8in+10in=47500`.
No consultation product. Customer-provided figurines have no purchase charge after this is verified/negotiated; design charges are independent. Receipt alone does not guarantee production/pickup or authorize payment.

## 2. Files, shapes and numeric rules

- `cake-wire-types.ts`: type-only scalar/contact/S’more/error/capability shapes, identical between the two wire versions. No runtime helper is shared.
- `custom-cake-contract.ts`: `custom-cake.v1` requests, quote/acceptance and separate creation/lookup/mutation responses.
- `cake-order-v2-contract.ts`: `cake-order.v2` ordinary Cake/standalone/add-on requests and authoritative priced responses.
- All JSON objects use the exact fields described by their selected union variant. Unknown fields are rejected, including caller-supplied price/discount/gifts. No undefined/NaN/Infinity/negative/fractional cents. `Cents` is a nonnegative safe integer; TS cannot encode that range, so each consumer validates it independently.
- Transport retains `{action, data}` requests and `{ok:true, result}` success envelopes. Named request types describe data and response types describe result. New opt-in action failures use ContractError (`ok:false`, contractVersion, code); legacy actions retain their exact existing envelope. No action name or payload is added to old v1 acceptance rules.
- Quantities are positive safe integers. Ordinary Cake retains existing quantity/aggregate-identical-option limits (currently 5); custom lines use the same 1–5 Cake quantity bound. Splitting identical selections into distinct IDs must not bypass that bound. S’more retains safe-integer amount overflow checks. Paid S’more quantity is a count of sticks, not a multiplier of parent quantity.
- Strings: contact name trimmed (2–80), email trimmed/lowercase and valid (≤120), AU phone normalized to valid `04` + 8 digits. Notes trimmed (≤1000). Pickup uses `YYYY-MM-DD` / `HH:mm` Sydney local wall time; server validates real date/time and applicable availability. Do not promise a new custom lead time.
- IDs are case-sensitive ASCII `[A-Za-z0-9_-]{1,64}`. `requestId` is a lowercase UUID v4. Photos are opaque validated owned references using the ID syntax, never arbitrary URLs/credentials; duplicated refs are invalid. No upload implementation in this commit.
- Canonical stored timestamps are UTC ISO with exactly 3 fractional digits and `Z`. Wire version is NOT `orderLinesJson.version`; no stored schema/version is changed here.

## 3. custom-cake.v1

### Requests and responses

`CustomCakeCreateRequest`: contractVersion, requestId, customer, pickup, requestNote, privacyConsent=true, lines.
At least one `kind:'custom-cake'` line is required. Each has lineId, null parentCakeLineId, productId='custom-cake', quantity, tier/size, designNote, figurineSource ('none'/'customer'/'shop'), photoRefs. Paid standalone/add-on S’more may accompany it. An add-on's parent must be a custom Cake in this same request; ordinary Cake uses the v2 route instead.

`CustomCakeCreateResponse`: contractVersion, requestId, requestNumber, status='requested', quote version 1 with provisional amounts, paidSmoreLines, acceptance=null. No public fingerprint, admin memo or secret. A replay returns the originally committed creation response, not the latest quote. Clients use lookup to see subsequent quote changes.

`CustomCakeLookupRequest`: contractVersion, requestNumber, customerPhone; apply existing authenticated/customer-possession lookup privacy controls and anti-enumeration policy. A number alone never authorizes access.
`CustomCakeLookupResponse`: contractVersion, requestNumber, status, customer, pickup, lines, quote, paidSmoreLines, acceptance, acceptanceHistory. It is not the creation response shape. Photo refs require separately authenticated retrieval and convey no public access themselves.

Proposed future action names: `create-custom-cake-request`, `get-custom-cake-request`, `admin-update-custom-cake-quote`, `admin-record-custom-cake-acceptance`, `admin-confirm-custom-cake-request`. All admin actions require the existing administrator authorization boundary. Action names are reserved by this document only; no handlers exist yet.

### Quote fields

| Field | Meaning |
| --- | --- |
| quoteVersion | Positive safe integer, initial 1; each successful quote-content change increments exactly 1. |
| pricingPolicyVersion | `custom-cake.2026-09.v1`, pinned at initial successful receipt, retained on edits/retries. |
| promotionEligibilityAt | Server first valid persisted receipt instant, immutable. |
| currency | Literal AUD. |
| baseCents | Sum of Custom Cake base unit price × quantity, excluding all extras/S’more. |
| cakeDiscountCents | Sum of eligible Custom line 5% discounts; never includes negotiated extras. |
| designExtraCents / figurineExtraCents | Quote-level negotiated totals, not per-unit amounts: null = not agreed; 0 = agreed no charge; positive = agreed charge. Both required even if source is none/customer; admin explicitly resolves to 0 where appropriate. |
| paidSmoreQuantity / paidSmoreTotalCents | Total paid sticks / their server-calculated post-discount sum. Never include gifts. |
| giftSmoreQuantity | Sum of eligible Custom Cake quantities ×2, otherwise 0. |
| knownTotalCents | baseCents − cakeDiscountCents + known numeric extras + paidSmoreTotalCents. For this arithmetic only, unknown extras contribute zero; they remain null on wire, never silently settled. |
| isFinalQuote / finalTotalCents | Both extras numeric iff isFinalQuote=true; then finalTotalCents equals knownTotalCents. Otherwise false/null. “Final” means price settled, NOT customer accepted or reservation confirmed. |

No generic `totalCents` in Custom quote. Ordinary v2 has a definitive `pricing.totalCents`; the types intentionally differ. Initial receipt sets both negotiated extras null. Base choices/quantities/paid lines are immutable in this minimal quote-edit API: changing them requires a new submission intent, not an unversioned price edit. Admin may revise only extras/explanation until confirmation.

### Quote state, acceptance and atomic version checks

- Initial state requested / version 1 / provisional. `UpdateCustomCakeQuoteRequest` supplies requestNumber, expectedQuoteVersion, designExtraCents, figurineExtraCents, explanation. Accepted in requested/quoted only; mismatch -> QUOTE_VERSION_CONFLICT, no writes. Successful edit -> quoted, version+1. Server pins original eligibility and base/paid/gift amounts, recomputes only negotiated totals. A retry with old expected version conflicts; read latest before resubmitting. No silent overwrite.
- `AcceptCustomCakeQuoteRequest` contains requestNumber, quoteVersion and customerConsent=true. An authenticated admin records actual customer agreement; merely receiving a quote is not agreement. Server stamps acceptedAt (never trusts a supplied clock) and appends `{acceptedQuoteVersion, acceptedAt}` to immutable acceptanceHistory. Require current version and final quote. Repeating acceptance for the same unchanged version returns the existing record/time, not a second event.
- Acceptance is allowed in quoted only. In confirmed, only a same-version already-recorded acceptance replay succeeds without writing. Requested, cancelled and completed reject acceptance with QUOTE_STATE_CONFLICT. Update likewise rejects any state other than requested/quoted with QUOTE_STATE_CONFLICT.
- Quote revision preserves old acceptance history and latest acceptance reference, but that reference is stale unless it matches the new quoteVersion. Stale agreement cannot authorize a new amount. Subsequent explicit acceptance appends a new version/time.
- `ConfirmCustomCakeRequest` contains requestNumber and expectedQuoteVersion. In one atomic compare/transition, server checks expected==current, isFinalQuote===true, acceptedQuoteVersion==current and acceptedAt present. Only then confirmed. A concurrent revision cannot slip between checks and confirmation. After confirmed, this edit contract is closed; completed/cancelled are terminal for quote/acceptance mutation. Confirmation replay of the same already-confirmed version is a no-op success.
- Confirmation source must be quoted, except the same-version confirmed replay above. Requested, cancelled and completed always reject with QUOTE_STATE_CONFLICT even if a historical accepted final quote exists. Confirmed with a different expected version rejects QUOTE_VERSION_CONFLICT; never creates another confirmation.
- Check order: authorization → object/version validity → allowed source state → expected/current version → final quote → acceptance. Missing acceptance -> QUOTE_ACCEPTANCE_REQUIRED; stale acceptance -> QUOTE_VERSION_CONFLICT; provisional -> QUOTE_NOT_FINAL. No existing reservation state/transaction is rewritten in this contract commit.
- `CustomCakeMutationResponse` has the lookup snapshot shape. Status set: requested, quoted, confirmed, completed, cancelled. The approved supplement in §9 defines completion/cancellation actions; no handler is implemented by this contract-only commit.

## 4. cake-order.v2

`CakeOrderV2Request`: contractVersion='cake-order.v2', requestId, customer, pickup, requestNote, privacyConsent=true, promoCode (empty means none), lines. Supports standalone-only S’more. Custom Cake is not an ordinary v2 product.

| Line | Request fields |
| --- | --- |
| Cake | kind='cake', lineId, parentCakeLineId=null, active Cake productId, quantity, complete `CakeOptionsV2` |
| Standalone | kind='standalone-smore', lineId, parentCakeLineId=null, productId='smore-stick', quantity |
| Add-on | kind='cake-addon-smore', lineId, parentCakeLineId=existing Cake lineId, productId='smore-stick', quantity |

V2 options use the exact required property order/shape in CakeOptionsV2: cakeSize, chocolateType, poundAddon, cupcakeFinish, chocolateIcingCount, chocolateExtra, brownieCreamOption, vanillaCreamCount, partyDecorationCount, vanillaCakeSheet, vanillaCakeFlavor, vanillaCakePointColor, individualPackaging. Product-specific normalization/acceptance remains the current required-catalog new-order policy, not stored compatibility. UI adapters supply all fields; server validates and normalizes them, never trusts UI pricing. Invalid combinations remain invalid. No legacy current-product aliases are enabled by v2.

`CakeOrderV2CreateResponse`: contractVersion, requestId, reservationNumber, status='예약신청', pricing.
`CakeOrderV2LookupRequest`: contractVersion, reservationNumber, customerPhone.
`CakeOrderV2LookupResponse`: contractVersion, reservationNumber, status, customer, pickup, pricing. Existing reservation status values remain unchanged. Pricing is saved server output, not recalculated during lookup/replay.

`pricing`: currency='AUD', pricingPolicyVersion='cake-order.2026-09.v2', pricedAt, priced lines, subtotalCents, discountCents, individualPackagingFeeCents, totalCents.
Priced Cake adds unitPriceCents, chocolateExtraCents, subtotalCents, discountPercent (0/5/10 under existing eligible policy), discountCents, individualPackagingPieces, individualPackagingFeeCents, totalCents. Existing option surcharge, extras-per-line, packaging and coupon arithmetic/rounding order remain unchanged.
Priced S’more adds unitPriceCents=450, subtotalCents=450×quantity, discountPercent=0 for standalone /30 for valid add-on, discountCents=0 /135×quantity, totalCents=450×quantity /315×quantity. No 10/20 or additional coupon on either S’more variant. Guard safe-integer multiplication/sums.
Order totals are sums of priced lines; total=subtotal−discount+packaging. Current Cake coupon allocation retains aggregate rounding/largest remainder, deterministic ties by canonical option identity then lineId for distinct equal-option lines. The v1 algorithm is not modified.

Future action names: `create-cake-order-v2`, `get-cake-order-v2`. Existing v1 action and exact unknown-field rules are not widened. Existing v1 lookup/retry remains a separate entry point.

## 5. Stable line identity, canonical bytes and idempotency

- Cart creates lineId once and persists it with the item. Restore/reorder/retry keeps it. New item gets new ID. Never generate IDs during submit, canonicalization or server pricing.
- Unique lineIds per request: duplicate ID is invalid, even byte-identical duplicates. Different IDs are NOT automatically merged, even for identical options. Preserve each association; validate current aggregate quantity limits separately. An explicit cart merge must update all child references, produce a new requestId and cannot mutate an in-flight submission.
- Cake parent is null. Standalone parent is null. Add-on parent is mandatory, same-order Cake kind (`cake` for v2, `custom-cake` for custom v1). Missing ID, self, S’more parent, cross-order parent and cycles are rejected with INVALID_LINE_REFERENCE. Duplicate/invalid IDs use INVALID_LINE_ID. Parent deletion does not silently grant/retain 30%; stale graph is rejected. UI must explicitly remove child or change to standalone and show full price under a new submission intent.
- Top-level canonical field order: contractVersion, customer, pickup, requestNote, privacyConsent, then promoCode for v2 only, then lines. Exclude requestId (separate idempotency key), action, server timestamps/prices, quote/acceptance fields. Customer order: customerName/customerPhone/customerEmail; pickupDate/pickupTime. Trim textual contact/notes; email lowercases, AU phone normalizes. No Unicode normalization or locale-dependent sorting.
- Sort lines by raw ASCII lineId ascending. Custom line property order: kind,lineId,parentCakeLineId,productId,quantity,tier,size,designNote,figurineSource,photoRefs. Cake order: kind,lineId,parentCakeLineId,productId,quantity,options. S’more order: kind,lineId,productId,quantity,parentCakeLineId. Photo refs sorted ASCII; duplicates invalid. All fields explicit, no omitted/null interchange except declared nullable fields. V2 options normalized first by current new-order rules, then emitted in the option order above. JSON.stringify, UTF-8, no whitespace/newline; numbers are safe integers (no -0).
- New hash domains: `custom-cake-request-v1\0` and `cake-request-v2\0`, followed by canonical JSON bytes, HMAC-SHA256 with existing server-owned secret infrastructure. Test key is synthetic 32 bytes of 0x07. No production keys in artifacts. Existing `cake-request-v1\0` and old canonical/hash code remain untouched.
- Same requestId + same wire domain + same canonical => one receipt/price/gift record and original creation result; reordered lines/photos are the same intent. Same ID with changed quantity/option/parent/ID/text/wire version => REQUEST_ID_CONFLICT. Changing intent requires a new requestId. Canonical excludes pricingPolicyVersion/clock, so retries cannot pick up later policy/time. Server must bind stored idempotency records to wire domain and creator authorization scope.
- This specifies bytes for future implementations; the test helper is NOT a production canonicalizer. Fixture canonical strings are fixed independent expectations.

## 6. Capability and old-client cutover

`get-cake-wire-capabilities` is a new opt-in future request (no payload beyond action). Response CakeWireCapabilities: contractVersion='cake-capabilities.v1', status='ready', customCakeV1:boolean, cakeOrderV2:boolean, legacyNewSubmissions='compat'|'required'. It is not appended to legacy health and not fed to the old exact capability parser. Unknown action/unavailable capability keeps new UI disabled; do not infer readiness from HTTP success alone.

Required sequence: **backend compat → v2 frontend → smoke → backend required**.
Compat serves both old protocol and new opted-in protocol temporarily, with each protocol's recorded policy. Existing 10%/20% can therefore still occur for legacy new requests during compat; full new-order bulk abolition is complete only after required.
Smoke includes supported/unsupported capability, ordinary Cake+add-on, standalone 6/12, custom event boundary, duplicate request, old lookup/retry, quote revision/stale acceptance and all archive modes.
Required: locate/authenticate existing idempotency record and verify old stored fingerprint first. Exact old retries return stored response/price with no repricing or gift regeneration. Existing-ID mismatch -> REQUEST_ID_CONFLICT. No existing record + old v1 new submission -> **409 CAKE_ORDER_UPGRADE_REQUIRED**, no write/coupon reservation. This applies to old general Cake create actions, not class actions or lookup. An old anonymous request without a verifiable matching key is a new submission and cannot bypass this gate.
Required does not change old lookup formats or permit new fields on old requests. Frontend must handle upgrade explicitly, retain unsent cart, refresh capability; never silently fall back to v1 after a v2 timeout. Rollback after required disables new submissions if needed, keeps new/historical read/retry support; do not reenable legacy discounted writes silently.

## 7. Error envelope and authorization

New-version error body: `{ok:false, contractVersion, code}`. No stack, secret, raw database record or fingerprint. HTTP mapping:

| HTTP | Codes |
| --- | --- |
| 400 | INVALID_REQUEST, INVALID_LINE_ID, INVALID_LINE_REFERENCE, INVALID_PHOTO_REFERENCE, PROMO_CODE_INVALID |
| 403 | FORBIDDEN |
| 404 | NOT_FOUND (also use privacy-safe not-found for invalid customer lookup credentials) |
| 409 | REQUEST_ID_CONFLICT, QUOTE_VERSION_CONFLICT, QUOTE_NOT_FINAL, QUOTE_ACCEPTANCE_REQUIRED, QUOTE_STATE_CONFLICT; legacy-only CAKE_ORDER_UPGRADE_REQUIRED |
| 503 | CAPABILITY_UNAVAILABLE |

The required-gate error on the OLD endpoint is exactly `{ok:false, code:'CAKE_ORDER_UPGRADE_REQUIRED'}`, HTTP 409, not a new-version body the old parser cannot read. LegacyCakeUpgradeError is separate from ContractError; the new v2 endpoint does not report a v1 upgrade error. No old error field/code is reinterpreted. JSON/type declarations are not an authorization layer; future server tests must prove actor/ownership checks, atomic compare/update/confirmation and private photo access.

## 8. Fixtures and acceptance gates

- `custom-v1.json`: create/lookup/final responses, six base sizes, null/0/positive extras, pre/end event instants, multiple-quantity gifts.
- `cake-order-v2.json`: create/lookup, standalone and add-on 1/6/12, ordinary Cake coupon + nonstacked add-on, invalid/dangling/self/S’more/duplicate parent graph cases.
- `lifecycle.json`: quote CAS, provisional/missing/stale/matching acceptance, revised quote with preserved stale history, compat/required decisions, capabilities/errors.
- `canonical.json`: both complete requests, reorder variants, pinned JSON bytes/domains/fingerprints.

Contract tests check fixture shapes against erased types, monetary/reference/version relations and rejecting counterexamples. They do not prove real API authorization, persistence, pricing execution or transaction atomicity; backend implementation must add those integration tests using these fixtures. Stage 0 golden 17 is untouched; no existing runtime changed. Future intentional new-policy expectations use new fixture suites, never weaken old golden to hide drift.
After this commit SHA is reviewed, and only then, Antigravity/frontend and Codex/backend may branch from that exact SHA. No such branches or operational actions are created here.

## 9. Approved supplement — terminal lifecycle

Contract parent: `caa9a96ca9c16dea44ffdcb3c785f6e72c7845cf`. This supplement adds documentation, erased types, static fixtures and contract tests only. Original pricing, canonical bytes, fingerprints and the original four fixtures remain unchanged.

Two existing-admin-authenticated actions are added to the contract: `admin-complete-custom-cake-request` and `admin-cancel-custom-cake-request`. Their data is `{contractVersion:'custom-cake.v1', requestNumber, expectedStatus, expectedQuoteVersion}`. Expected version is a positive safe integer. Success uses `{ok:true,result:CustomCakeMutationResponse}`. No runtime registration yet.

| Action | expectedStatus / allowed source | Target |
| --- | --- | --- |
| admin-complete-custom-cake-request | confirmed | completed |
| admin-cancel-custom-cake-request | requested, quoted, confirmed | cancelled |
| Any different transition from completed/cancelled | Forbidden | No change |

Authorization and strict shape validation happen first. In one atomic operation compare current status with expectedStatus, then current quoteVersion with expectedQuoteVersion: stale status -> `409 QUOTE_STATE_CONFLICT`; stale quote -> `409 QUOTE_VERSION_CONFLICT`. Preserve quoteVersion, quote, acceptance, acceptanceHistory, original creation response and request fingerprint. These state-only transitions do not increment a price version.

Exact terminal retry exception: persist the successful transition's action, source, target, quoteVersion and administrator audit identity/time atomically with status. If current status already equals target, a request with the exact recorded action/source/target/version may return the existing snapshot without writes after authorization and current quoteVersion validation. Target equality alone is NOT proof of replay. Different source or unproven transition -> QUOTE_STATE_CONFLICT; never overwrite another terminal state. This supports retry of the original expectedStatus rather than requiring clients to send a terminal expectedStatus. The original transition audit is not overwritten on replay.

Cancellation is not refund, payment reversal, charge cancellation or a payment API call. Completion/cancellation preserve all quote/acceptance/history. State changes and their retries must not implicitly send email. If a later approved notification is added, it must use a separately persisted event identity/outbox with existing deduplication/retry controls; no `status changed => send again` behavior.

## 10. Approved supplement — private reference photos

`src/lib/custom-cake-photo-contract.ts` defines the separate `custom-cake-photo.v1` wire. There is no new login/membership system. All photo actions use `{action,data}`, success `{ok:true,result}` and strict fields. Photo-specific failures use `{ok:false,contractVersion:'custom-cake-photo.v1',code}`. This is not an extension of the original order error union.

### Session, upload and attachment

1. Client creates/persists its stable requestId. `create-custom-cake-photo-session` data is `{contractVersion,requestId}`. Server issues a random opaque uploadSessionId and cryptographically random bearer uploadToken (at least 256 bits entropy), expiresAt and literal limits. Session lifetime is 30 minutes from issue, exclusive expiry; no sliding refresh. Store only a protected token digest, redact token/session credentials from logs, telemetry and URLs. Session issuance is rate/abuse limited and does not prove phone/email ownership or reserve event eligibility.
2. A repeated issue for the same requestId must NOT reveal/recover/replace a prior token, transfer staged photos or invalidate someone else's session. Each issued session is isolated, bound to requestId. Limits are enforced across concurrent uploads/attachments, not just a client counter. Expired sessions cannot upload or attach new requests; a new session requires reupload and confers no access to old staged files. No recovery based on requestId/phone/email alone.
3. `upload-custom-cake-photo` data: `{contractVersion,requestId,uploadId,mimeType,base64}`; credential comes only from `x-custom-cake-upload-session` and `x-custom-cake-upload-token` headers. uploadId is a stable per-file ASCII ID; same valid session/uploadId/input bytes+MIME replays the same photoRef, changed input -> PHOTO_UPLOAD_CONFLICT. Strict base64, no data URLs; HTTP body limits must permit the base64 expansion of 10 MiB but enforce decoded byte limits before expensive decode. Response: `{contractVersion,requestId,photoRef,state:'staged',mimeType:'image/webp',width,height,byteLength}`. All dimensions/byteLength are positive safe integers describing normalized output. Session is checked before processing and again before staging completion. Never return file keys, bucket IDs or URLs.
4. Record durable staged intent and ownership metadata BEFORE Storage upload. Keep immutable requestId/session binding, upload identity/digest, allocated photoRef/private file key and staging time, then upload only normalized bytes. A failed/uncertain upload remains discoverable for reconciliation; do not assume a thrown Storage error proves no file was created.
5. `create-custom-cake-request` keeps its EXACT original data shape and canonical bytes. When photoRefs are nonempty, the same two transport headers supply the session proof. In the successful request transaction attach only fully uploaded staged photos from that valid session and same requestId. Maximum 5 refs across all custom lines; reject duplicate refs across lines and mixed sessions. RequestId, phone, email or file ID alone is never ownership proof. Invalid session/ownership on this ORDER action -> existing `400 INVALID_PHOTO_REFERENCE` without leaking another owner's file existence. Empty photoRefs require no photo session. Credentials are never in order data/canonical/fingerprint/creation response.
6. Attachment atomically binds the chosen session, all photos and the new request; an incomplete/failed attach cannot produce a partly attached successful request. Existing request creation replay follows the original stored fingerprint and authorization checks FIRST; an expired/consumed upload token must not turn an already committed matching request into a new attach or reprice. No photo reads are granted by that replay. First receipt/event timing remains the original order contract.

### Fixed image limits and normalization

| Limit | Binding value |
| --- | --- |
| Photos | Maximum 5 per request, including concurrent uploads; duplicate refs do not create extra slots |
| Accepted input | JPEG / PNG / WebP only |
| Input byte limit | 10 MiB = 10,485,760 per file, inclusive; empty rejected |
| Decoded pixel limit | 20,000,000 pixels inclusive, validated before unbounded allocation |
| Frames | Exactly one; animated or multi-frame inputs rejected, not flattened |
| Validation | Declared MIME, magic signature and actual successful image decode must agree |
| Stored image | Canonical single-frame WebP, both dimensions ≤2560, aspect ratio preserved, no upscaling |
| Metadata | Apply orientation before stripping; remove EXIF and all ancillary source metadata; never store original bytes |
| Storage | Private bucket/files only; no public read permission or public URL |

The server encoder must use pinned deterministic settings for normalized output; those codec settings are internal implementation details, not customer wire fields. Reject malformed/truncated/decompression-bomb input. Never trust client dimensions, frames or MIME alone. Client previews do not substitute for server validation.

### Authenticated read and delete

`read-custom-cake-photo` and `delete-custom-cake-photo` data: `{contractVersion,requestNumber,photoRef,authorization}`. authorization is `{kind:'admin'}` or `{kind:'customer',customerPhone}`. These are selectors/proof inputs, not trusted identities: admin requires the existing independently verified admin transport authentication; customer requires the existing full request-number + normalized phone lookup possession check and its anti-enumeration/rate controls for THIS request. Phone alone is insufficient. Session tokens, email, file ID or requestId alone cannot read/delete attached photos. No new customer login. Recheck authoritative photo/request relationship on every operation; wrong customer, unrelated photo or unavailable/deleted photo reads return privacy-safe NOT_FOUND. Never issue a public or transferable Storage URL. Authenticated responses use `Cache-Control: no-store`; no shared cache.

Read result is `{contractVersion,photoRef,mimeType:'image/webp',base64,width,height,byteLength}` with normalized bytes. Delete result is `{contractVersion,photoRef,state:'deletion-pending'|'deleted'}`. Only attached photos of the authorized request (or their existing deletion tombstones for retry) are eligible for this delete wire. Pre-attach abandoned photos use internal orphan cleanup, not a requestId-only delete endpoint. Authentication failure never triggers deletion.

Authorized deletion atomically records a durable removal intent/tombstone and revokes read access, then retries physical deletion. Keep original immutable submitted photoRefs/canonical/creation replay, quote and acceptance/history intact; a removed reference resolves to NOT_FOUND and is not a broken pricing record. Active photo attachment metadata marks it removed rather than erasing audit provenance. Repeat authorized delete uses the same tombstone and returns pending/deleted without another event. Storage deletion failure keeps the retry record; never deletes or corrupts the request. This explicit customer/admin removal is separate from orphan cleanup's prohibition on deleting attached files.

### Staged/attach/cleanup lifecycle and race guarantees

Internal metadata states (not new DB schema in this commit): staging → staged → attached; staging/staged → cleanup-claimed → deleted. Explicit authorized attached deletion uses attached → deletion-pending → deleted. Upload/attach/delete failures retain durable recovery metadata. Expired session does not mean an attached image expires.

Orphan eligibility begins after a 24-hour grace from staged-intent creation, but age alone NEVER authorizes deletion. Before claiming deletion, re-read authoritative metadata AND its request (including uncertain commits). Any current attachment in either source means retain. Failed/ambiguous reads, inconsistent ownership or unresolved commit state mean retain and retry. Future/invalid timestamps mean retain.

Attach and cleanup must contend on the same atomic state/version fence: attach succeeds only from unclaimed staged; cleanup claims only from unattached staging/staged after grace and authoritative checks. A cleanup-claimed photo cannot subsequently attach. Re-read authoritative metadata/request before physical deletion; if attached, cancel deletion/retain and surface inconsistency. A plain read-check-delete sequence with an unfenced attach in between is forbidden. This follows review photo's durable intent + uncertain-attach reconciliation pattern and makes the late-attach race explicit.

If attach wins, cleanup cannot claim/delete. If cleanup wins, late attach fails safely with INVALID_PHOTO_REFERENCE, never creates a damaged successful request. If a Storage upload is still in flight when cleanup claims, its completion cannot attach; keep the claim/reconciliation work discoverable until late Storage outcomes are reconciled. Storage 404 is deletion success only after fenced in-flight uploads are resolved. Delete failure retains a durable retry; no cleanup failure may mutate the request, quote, acceptance or pricing.

### Photo error mapping and static coverage

| HTTP | Photo codes |
| --- | --- |
| 400 | INVALID_REQUEST, PHOTO_INVALID_IMAGE |
| 403 | PHOTO_SESSION_INVALID, PHOTO_SESSION_EXPIRED, FORBIDDEN |
| 404 | NOT_FOUND |
| 409 | PHOTO_UPLOAD_CONFLICT, PHOTO_STATE_CONFLICT, PHOTO_LIMIT_EXCEEDED |
| 413 | PHOTO_TOO_LARGE |
| 503 | CAPABILITY_UNAVAILABLE |

Missing/malformed/unknown session bearer is PHOTO_SESSION_INVALID; an authenticated expired session is PHOTO_SESSION_EXPIRED. Never expose another session's existence. PHOTO_TOO_LARGE covers byte/pixel bounds. PHOTO_INVALID_IMAGE covers MIME/signature/decode/frame failures. Capability readiness must not advertise usable Custom photo support until all required private operations and safe recovery are available; old health remains unchanged.

Supplement fixtures: `lifecycle-supplement.json` (actions, CAS/replay/terminal cases) and `photo.json` (wire examples, security limits, ownership, cleanup races). Tokens and byte payloads are synthetic contract illustrations, not valid image decoder fixtures. Static contract tests check actual TS assignability/rejection/erasure and scenario invariants; they do NOT prove image decode, authentication, Storage security or transaction atomicity. Backend must add real-image and controlled concurrent persistence tests later. This supplement activates no endpoint, Storage, migration, email or runtime policy.
