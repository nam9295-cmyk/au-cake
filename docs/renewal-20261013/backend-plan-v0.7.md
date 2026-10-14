# VERYGOOD AU v0.7 — Backend & Order Contract Implementation Plan

> **2026-10-14 실행 기준 갱신:** `public-decisions-20261014.md`와 사용자 구현 지시가 이 문서의 이전 지시보다 우선한다. 아래는 로컬 구현 기준이며 운영 배포/활성화 승인이 아니다.

| 구분 | 최신 기준 |
|---|---|
| 사용자 확정 | 파베 6/8/10인치 $75/$107/$159; 브라우니 홀6인치 $82, 로프 $58, 홀·로프 바닐라 +$10 |
| 시장조사 제안 → 로컬 검수만 승인 | 브라우니 홀8/10인치 $115/$155; 컵케이크6개 Basic/Vanilla $36/$42, 12개 $66/$78. 운영 가격 승인으로 간주하지 않는다 |
| 브라우니 컵케이크 | 6/12개팩, Basic/Vanilla Fresh Cream만. Chocolate Buttercream 신규 제외. 갸또의 세 finish 유지 |
| D01 해결 | 자유4구 각1개 구성은 설명과 명시적 '$35 시그니처로 담기' 버튼. 클릭하면 signature 저장. 자동 $35/$37 청구 금지 |
| D02 해결 | 수·금09:00–16:00, 토·일09:00–12:00 (Australia/Sydney). 월·화·목 일반 픽업 불가. 종료 시각을 마지막15분 슬롯으로 포함한다. Jenny 최종 확인 및 사용자 승인. 승인 대기 플래그는 폐기; 주문/사전예약 활성화는 별도 |
| D03 해결 | 모찌 선택 실물 개당 포장50c; 무료4구박스와 별개, $100 포장면제 없음 |
| D04 보류 | 쿠키3+3 고정6개 세트, 가격 null. 해당 offer 주문만 차단 |
| D05/D09 일부 해결 | 위 확정가와 잠정가를 구분. 잠정가는 로컬 UI/순수 검증만 사용, 서버 신규 접수 차단 |
| D06 | 쿠키·모찌 Sydney 2026-10-19 수동 활성화 계획, 정확한 개시 시각 미지정. 연속24시간과 승인 시간창의 교집합. 사업상 수량 상한 없음, 안전 정수/금액/요청 크기/권한/중복 방어 유지 |
| D07 해결 | 추가단품5% 부모는 파베홀/갸또로프/브라우니홀/브라우니로프 네 종류만. 모든 컵케이크·쿠키·모찌·스모어 제외. 과거 할인 보존 |
| D08 보류 | 실물 사진·최종 알레르기·보관 정보는 후속 자료로 완성. 기존 확인된 알레르기 정보 유지. 내부 레시피 공개 금지 |

신규 주문은 `au-renewal.2026-10.v1`, 저장 version 2. 과거 v1 계약/가격/사이즈는 변경하지 않는다. 운영 플래그는 기본 false이며 실제로 활성화하지 않았다. 기존 Custom Cake·KR·클래스 준비시간은 전역 변경하지 않는다.

> **For agentic workers:** `au-renewal-final-v0.7.md`를 먼저 읽는다. 설치된 경우 `superpowers:executing-plans` 또는 선택한 Codex 실행법을 따른다. 로컬 검증과 운영 배포를 구분한다.

**Goal:** 가격·포장·수량·정책을 서버가 검증하고, 5/4/3 분류 이동에도 기존 주문을 보존한다.

**Architecture:** 표시 membership과 판매 offer를 분리한다. 신규 정책과 frozen 역사 정의를 분리하고 순수 계산→검증→저장→모든 reader/운영출력을 연결한다.

**Tech Stack:** 현재 Node ESM Appwrite Functions, TypeScript 소비자, 기존 테스트/패키징.

**Spec:** `au-renewal-final-v0.7.md`; 기대값은 `qa-contract-v0.7.md`와 JSON fixture.

## Global Constraints

- 카테고리 이동한 컵케이크/스모어는 신규 판매 종료가 아니다. 레몬·옛Combo·종료상품과 구분한다.
- 카드5/4/3과 sellable SKU 수를 혼동하지 않는다. 브라우니2카드는 하나의 family를 참조할 수 있다.
- 브라우니 컵케이크는 6/12개팩과 Basic/Vanilla Fresh Cream 두 finish만 제공한다. 갸또의 기존 세 finish는 유지. 브라우니 잠정가는6개3600/4200c,12개6600/7800c이며 운영 신규 접수는 승인 전 차단한다.
- 5+1은 아몬드·파베·에펠; 스모어6/12개2500/4500c; 추가5%와중복없음.
- 두 컵케이크 포장50c·적격상품소계10000c 면제. **모찌낱개포장도50c 확정**, 그러나10000c면제는모찌에적용하지않는다.
- 자유4구 [1,1,1,1]은 시그니처와 동일함을 안내하고 명시적 $35 전환 버튼을 제공한다. 전환 시 signature 계약을 저장한다. 전환 없는 custom 확정 청구는 거절한다.
- 개인정보/운영 주문/메일/결제 없이 fixture/mock으로 검증한다. 배포·migration 별도 승인.

## Review Focus

1. category 변경으로 SKU나 추가상품 자격/직접구매를 없애는 오류 — BE1/4.
2. 자유4구와수량주문을 같은 합계4검증으로 처리하는 오류 — BE3.
3. 무료4구박스, cupcake100달러면제, 모찌실물개수×50c가 뒤섞이는 오류 — BE2/3.
4. 홀/로프·홀size·수량이저장뒤바뀌거나,미정홀가격이82로자동대체되는오류 — BE1/5.
5. 미확정요일/가격/정책 또는 고객flag로 서버제약을 우회하는 오류 — BE3/4/6.

## BE0 — 읽기 점검·파일 소유권·계약 합의

**Read 후보:** `AGENTS.md`, `package.json`, 현재 `cake-order-catalog.js`, `chocolate-products.js`, `active-cake-products.js`, `cake-order-input.js`, `src/lib/individual-packaging.ts`, cart/types, pricing·stored-order·notification/reminder·packaging 모듈. 실제 파일 위치와 최근 변경을 먼저 확인한다.

**Produces:** `docs/renewal-v0.7/order-contract.md`, `decision-register.md`, 기존→신규필드 매핑.

- [ ] 현재 HEAD/branch/dirty files/worktree 확인. 이전SHA로reset하거나새worktree생성하지 않는다.
- [ ] 현행 cart→request→서버가격→orderLinesJson→reader 경로 및 API지원/버전 정책을 기록한다.
- [ ] D01–D09를 실제 근거로만 해결하고 공유카탈로그·타입·가격파일 소유자를 하나로 정한다.
- [ ] 쿠키·모찌는 사업상 수량 상한 없이 안전 정수·금액 overflow·요청 크기를 검증한다. 연속24시간과 승인 픽업 시간창을 교차 계산한다. 10/19 수동 활성화 계획이며 개시 시각은 임의 지정하지 않는다.

## BE1 — 표시분류·판매레지스트리, 파베 가격·브라우니 사이즈

**Modify 후보:** active catalog, 신규판매 registry, 공통form/offer types, brownie options.

**Create 필요시:** `appwrite-functions/reservation-api/src/au-sales-offers.js` (같은 역할 존재 시 확장).

**Test 제안:** `tests/au-v07-sales-offers.test.mjs`.

**Interface 제안:** `resolveActiveOffer(market, offerId)` → 단가·판매단위·실물구성·허용옵션·상태. 실제export명은BE0에서고정.

- [ ] RED: Q-NAV/Q-BROW/Q-SMORE/Q-BUNDLE의 active offer와가격을검증한다.
- [ ] 이동한 cupcake/smore는유지, 레몬/Combo/종료cake는신규거절, 과거reader유지.
- [ ] 파베8in신규가격10700c를서버가격원본에적용한다.6in7500/10in15900유지,과거8in10900스냅샷은보존.
- [ ] 브라우니 홀6인치8200c는 사용자 확정. 8인치11500c/10인치15500c는 로컬 검수용 잠정가이며 운영 신규 주문은 거절한다. 과거 무사이즈82 주문의 사이즈를 자동 보정하지 않는다.
- [ ] whole에서알수없는size·누락size·미설정price·타형태size조합을검증한다. loaf에는별도원형size가없고5800c유지.
- [ ] 두형태vanilla1000c유지. cupcake는basic/vanilla-fresh-cream/chocolate-buttercream 선택을등록하되1000c나갸또finish가격을자동복사하지않는다.
- [ ] 브라우니 컵케이크의 위 별도 잠정 가격표를 사용하고 갸또 가격이나 홀 생크림 +1000c를 복사하지 않는다. 내부 생산 참고 수치를 주문 상한으로 사용하지 않는다.
- [ ] GREEN: node --test의해당mjs 및회귀테스트,작업파일만커밋.

## BE2 — cupcake 박스 수와 포장 정책 확장

**Modify:** 현재pack quantity/pricing, 개별 포장 모듈, 실제TS/서버양쪽소비자.

**Test 제안:** `tests/au-v07-cupcake-packaging.test.mjs`.

**Interface:** `priceIndividualPackaging(lines)`(제안) → 적격실물개수·적격소계·기본포장료·면제액·최종포장료.

- [ ] RED: 갸또6/12구박스수·finish117/102예시, pack×quantity의단일곱셈.
- [ ] RED: 포장선택한갸또+브라우니소계합계9999c는유료,10000c는면제. 이 경계 입력은 함수테스트이지브라우니판매가아님.
- [ ] 브라우니cup의실제팩/단가가없어도포장정책코드는family단위로테스트한다. 갸또팩/단가복사금지.
- [ ] 미선택줄·다른초콜릿·모찌·추가상품·포장료로면제기준을채우지않게검증한다.
- [ ] 수량/finish/포장수정·행분리·병합·동일상품상한우회검증후GREEN/커밋.

## BE3 — 모찌3모드·포장·D01

**Modify/새로필요시:** 현재모찌registry와 `mochi-box-policy.js`.

**Test 제안:** `tests/au-v07-mochi-contract.test.mjs`.

**Interfaces:**
- `signature`: 고정상자당[1,1,1,1], 3500c, boxCount.
- `custom-four`: 상자당정수맵합4, 단가 합산, boxCount, D01같은 구성경계.
- `quantity`: 맛별절대수량합≥1, 각단가×수량. 합4제약과boxCount배수없음.
- `packagingMode`: gift4 / standard / individual 또는현재동등값. 모찌individual은50c/실물1개, gift4는표준박스무료. 누락된구버전정책을무료로fallback하지않음.

- [ ] RED: Q-MOCHI의단가·시그니처35·다른자유 구성·수량5개47·박스2의맛별집계.
- [ ] RED: mode위조·signature딸기4주입·custom3/5개·quantity소수/음수·상한우회거절.
- [ ] 자유4구 [1,1,1,1]은 시그니처와 동일함을 안내하고 명시적 $35 전환 버튼을 제공한다. 전환 시 signature 계약을 저장한다. 전환 없는 custom 확정 청구는 거절한다.
- [ ] D03요금확정을반영해개별포장료를선택모찌실물수×50c로계산한다.5개47.00+2.50=49.50,토글off47.00을직접API테스트한다.
- [ ] 상품소계100달러이상의모찌도낱개요금을받는다. 딸기10개105.00은순수계산fixture이며주문상한승인은아니다. cupcake면제자격과격리한다.
- [ ] 모찌포장한행/안한행을섞으면포장한수량만계산. 고객fee=0/discount/무료flag는서버가신뢰하지않는다.
- [ ] gift4포장0과individual요금분리. 서버가무료면제정책을임의확대하지않는다.
- [ ] 신규모드·구성·포장·가격근거를정규화해FE/저장으로전달, GREEN/커밋.

## BE4 — 추가구매5%, 일반5+1·스모어·쿠키

**Modify:** 기존attached extras/parent validation·offer pricing·cookie상품/개시정책.

**Test 제안:** `tests/au-v07-promotions-and-cookie.test.mjs`.

**Interface:** 부모는같은cart의검증된실제상품이며카테고리URL이아니다. 반환값은base/discount/net와physicalUnits.

- [ ] RED: 연결 추가단품5%의 신규 부모는 파베홀·갸또로프·브라우니홀·브라우니로프만 허용한다. 갸또컵케이크의 종전 자격 유지 문장은 폐기한다. 과거 적용 주문은 그대로 읽는다.
- [ ] RED: 파베1140/생크림665/아몬드1140/에펠950; 부모없는생크림·타주문ID·5+1추가구매거절.
- [ ] 추가단품units를부모박스수로곱하지않고, 브라우니위토핑1000c에는5%없음.
- [ ] RED: 5+1삼종과스모어2500/4500고정·과거tier혼입없음, 할인중복없음.
- [ ] 쿠키3+3×세트수와독립개시 조건구현. 가격null/누락/위조입력으로판매불가,모찌지원flag가쿠키를허용하지않음.
- [ ] GREEN/커밋.

## BE5 — 저장·조회·관리자·알림·생산 호환

**Modify:** 실제request/response codec, order engine, stored-order reader/policy, 관리자/조회/PIN/CSV/Notification/Reminder 및Function패키징.

**Test 제안:** `tests/au-v07-roundtrip.test.mjs`, `tests/au-v07-history.test.mjs`.

- [ ] RED: 신규모찌모드/수량/개당50c포장, 두brownie형태·홀size+10, 갸또박스수,smore팩·에펠팩/조각,추가구매부모가round-trip후같다. 홀size가다르면같은행으로합치지않는다.
- [ ] RED: 옛레몬/Combo/smore낱개/브라우니+20/옛모찌가격과픽업은원래대로읽는다. 과거파베8in10900은그대로,옛브라우니82무사이즈주문에6in을자동생성하지않는다.
- [ ] 가격은현재레지스트리로과거 주문을재계산하지않는다. 같은SKU의포장을옛주문에덮어쓰지않는다.
- [ ] API미지원field를누락시켜주문성공하지않고기존버전협상과멱등성유지.
- [ ] 관리자편집·수량변경에서주문시점정책과재가격승인을구분한다. 기존결제/환불흐름을새로설계하지않는다.
- [ ] 새모듈이오프라인Function/TS테스트산출물에포함되는지검증, GREEN/커밋.

## BE6 — 픽업변경판독·예약개시·운영보호

**Modify:** 현재pickup schedule/policy·preorderconfig·공통안내.

**Test:** `tests/au-v07-pickup-and-preorder.test.mjs` + 기존pickup/class/customsuite.

- [ ] 수·금09:00–16:00, 토·일09:00–12:00 (Australia/Sydney). 월·화·목 일반 픽업 불가. 종료 시각을 마지막15분 슬롯으로 포함한다. 접수일+24시간과 승인 시간창을 검증한다.
- [ ] 수·금09:00–16:00, 토·일09:00–12:00 (Australia/Sydney). 월·화·목 일반 픽업 불가. 종료 시각을 마지막15분 슬롯으로 포함한다. 과거확정월요일은reader/인계목록에보존.
- [ ] 쿠키·모찌예약개시10/19와첫 픽업일·정확한 시각·준비시간을별도검사한다.
- [ ] driver flag/희망시간이휴무·리드타임검증을우회하지않게한다. 운영자예외는권한/감사로그필요.
- [ ] 전체시험·lint·AU/KR빌드·패키징·정적SEO검증. 신규테스트를실제전체suite에포함.
- [ ] reader→API→FE→승인된정책활성화순서와롤백을문서화한다. 실제배포·주문전송하지않는다.
