# Customer Account Stabilization Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans. 사용자가 지정한 Mac Codex 단독 실행을 유지한다. 이 계획은 2026-10-17 안정화 실행 승인에 따른 기술 작업 순서이며 추가 제품 범위나 운영 승인을 요청하지 않는다.

**Goal:** 최신 main 픽업 정책을 feature 브랜치에 통합하고, 동일 계정 인증 재검사에서 편집/상세 화면을 유지하며, 의존성과 Node 22/24 차이를 검증한다.

**Architecture:** 승인된 worktree에서 일반 merge만 사용한다. checking 상태의 이전 identity는 AccountPanel 수명 유지에만 사용하고 hidden/inert 처리한다. 인증 결과가 guest/unavailable/다른 UID면 해당 패널을 폐기한다. profile 저장은 시작 UID와 refresh generation에 묶는다. 기존 transport/owner/가격·쿠폰·판매 계약은 보존한다.

**Tech Stack:** 기존 React/TypeScript/Vite, Appwrite SDK, Node test runner, Playwright CLI, locked npm dependencies. 로컬 Node 24.12.0 및 별도 npx Node 22.23.3.

**Spec:** 사용자 최종 안정화 승인 및 [고객 계정 설계](../specs/2026-10-17-customer-account-design.md).

## Global Constraints

- `/Users/nam9295/Desktop/john_2.0/code/au-cake-customer-account`, `feat/customer-account`만 수정한다. 시작 HEAD `dc8cba6`, 확인된 local/remote main `34ba107`.
- main을 feature에 일반 merge한다. feature를 main에 병합하거나 rebase/reset/history rewrite하지 않는다.
- frontend/server customer flag 기본 OFF, 가격/쿠폰/판매 정책 불변. Custom Cake/Kids Class 회원 연동 없음.
- npm audit fix/자동 dependency upgrade 없음. 실제 운영 리소스·고객 데이터·Appwrite 프로젝트 생성·migration·배포·Google/SMTP 변경 없음.
- 기존 테스트 삭제/완화 없음. 실제 provider/container/device 미검증을 로컬 Mock 증거와 구분한다.

## Review Focus

1. 중복 focus와 늦은 restore/saveProfile가 이전 UID를 다시 표시하지 않아야 한다.
2. checking 동안 보존한 private 패널은 화면/접근성/입력에서 숨기고, 세션 소실 때 제거해야 한다.
3. 동일 UID면 미저장 name/email/phone/language와 열린 detail·pagination을 유지해야 한다.
4. 13:00 주말 pickup 경계와 Google 왕복 후 동일 requestId/coupon·guest/member 제출이 유지돼야 한다.
5. root omit-dev audit 0이 Function sharp 위험이나 실제 Linux container 검증 완료를 뜻하지 않아야 한다.

### Task 1: 최신 main의 일반 merge

**Files:** main `34ba107`의 pickup policy/content/docs/기존 tests 16개 파일. 기존 feature source에는 별도 정책 변경 없음.
**Interfaces:** 동일 `au-renewal-pickup.2026-10-14.v2`, 주말 09:00–13:00, 15분 간격. 이후 UI/SDK/browser 검증은 통합된 policy를 사용한다.

- [x] clean baseline `npm test`, main/remote SHA·diff·경계 확인.
- [x] `git merge --no-ff --no-commit main`; 충돌은 원인과 계약을 먼저 확인한다.
- [x] `npm run test:renewal`, `npm run test:customer-account`, 전체 `npm test`, diff 확인 후 merge commit. 가격/catalog/쿠폰/판매 source와 allowlists가 merge로 바뀌지 않았는지 확인한다.

### Task 2: focus 재검사에서 안전한 AccountPanel 보존

**Files:** Modify `src/CustomerAccountProvider.tsx`, `src/lib/customer-account-types.ts`, `src/lib/customer-auth.ts`, `src/pages/AccountPage.tsx`; tests `tests/customer-account-refresh.browser.mjs`, `tests/customer-auth.test.ts`, `tests/customer-account-page.test.tsx`.
**Interfaces:** checking의 optional `previousIdentity`는 미확정 인증으로 간주한다. AccountPage만 이를 이용해 기존 UID 패널을 hidden/inert 상태로 유지한다. `CustomerAuth.saveProfile(input, expectedUserId)`는 세션 UID 불일치 시 쓰기 전 거부한다. context의 profile 저장 공개 signature는 유지한다.

- [x] real mounted AccountPage에서 미저장 네 필드/열린 detail → focus 확인 후 보존 assertion을 작성하고 RED 확인.
- [x] 같은 UID 중복 재검사, pending 중 hidden/inert, 다른 UID 및 expired/failed session 때 이전 form/detail 제거, late A read/save 결과 차단 테스트를 추가한다. auth adapter는 잘못된 expected UID이면 prefs write 0을 검증한다.
- [x] checking 이전 identity를 보존하고, 같은 UID key의 패널을 숨긴 채 유지한다. 저장 응답은 UID/intent/epoch 일치일 때만 반영한다. 새 storage나 profile draft table은 추가하지 않는다.
- [x] 신규/기존 auth/account/Checkout/admin regression, lint/TypeScript, 전체 tests와 Chrome/WebKit GREEN 후 기능 커밋.

### Task 3: 의존성·Node 런타임·최종 인수

**Files:** Create `docs/customer-account-stabilization.md`; update validation/rollout 문서와 이 계획의 상태. dependency versions/lockfiles/runtime 설정은 조사만 하며 바꾸지 않는다.
**Interfaces:** root full/omit-dev 및 4 Function audit을 별도로 집계한다. advisory의 원문과 실제 import/input 경로, Node engine/deployment gate를 대조해 운영/개발 영향과 패치 위험을 기록한다.

- [x] npm audit JSON, npm ls, upstream advisory/patch, sharp input validator와 deploy runtime 설정 조사. 자동 update 없이 대응 및 패치 검증 조건을 기록한다.
- [x] Node 24와 Node 22에서 전체 npm test 및 신규 suite를 실행한다. Node 22에서 실제 codec/native sharp와 Function archive import를 확인한다. 실제 Appwrite runtime API/거래·cookie 검증은 별도 미완료 gate로 남긴다.
- [x] TypeScript/ESLint, KR→AU build·static 검증, Renewal/guest lookup/admin/coupon/idempotency, Chrome/WebKit 핵심 script와 default-OFF callback 복원 재검증.
- [x] 전체 diff 자체 리뷰, 단계별 SHA·정확한 pass/fail/skip·취약점 분류·provider 준비사항·Git 상태를 문서 커밋으로 보고하고 멈춘다. 기존 두 worktree·복구 태그 보존, main/production 변경 없음.

## 완료 상태

승인된 로컬 안정화를 완료했다. 실행 코드 후보 `ec22c34`, main 통합 `9b34129`. 정확한 검증 수, 의존성 분류, 파일/커밋과 미완료 외부 gate는 [최종 안정화 기록](../../customer-account-stabilization.md)에 기록한다. 실제 Appwrite 프로젝트·리소스·운영 설정·배포·main 병합은 수행하지 않았다.
