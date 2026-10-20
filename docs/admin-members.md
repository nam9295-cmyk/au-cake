# 관리자 회원 명단 — 로컬 구현 및 운영 적용 대기

2026-10-20. 승인된 `feat/customer-account` worktree에서 구현했다. 운영 설정·배포·회원 데이터는 변경하지 않았다.

## 현재 계정 수 확인

기존 공식 Owner 인증의 GET `/users`로 확인했다. 운영 `verygood-au`는 **2계정**이며 알려진 본인 로그인 이메일과 테스터 이메일이 각각 1개 일치했다. 기존 관리자 allowlist UID도 목록에 존재한다. 격리 프로젝트 `verygood-au-account-test`는 **3계정**(테스트 관리자 M + Google G/H)이다. 따라서 테스트 프로젝트의 3개를 운영 고객 3명으로 집계하면 안 된다. 이메일·전화번호·전체 회원 문서는 로그/보고서에 보관하지 않았다.

## 구현

- AU 관리자 메뉴에 **회원 명단**, 경로 `/admin/members` 및 trailing slash 지원. 기존 `AdminFrame`과 스크롤 테이블 CSS 재사용. KR에는 메뉴/경로 및 정적 회원 페이지를 추가하지 않는다.
- 이름, 로그인 이메일, 주문 연락 이메일, 호주 전화번호, 가입일, 관리자/회원 구분, 정상/차단 상태를 조회한다. 총 계정 수는 관리자를 포함한다고 표시한다.
- 로그인 이메일 검색, 25개 단위 cursor 페이지 이동, 새로고침, loading/empty/error 상태. 검색은 Appwrite의 계정 검색이며 Preferences 연락처 전체 검색이라고 표시하지 않는다.
- 저장된 `verygoodAuCustomer` 프로필을 읽고, 없거나 유효하지 않은 필드는 Account 기본값으로 표시한다. 과거 주문 snapshot을 조회하거나 수정하지 않는다.
- 회원 수정·차단·삭제·CSV 내보내기·마케팅 발송은 구현하지 않는다.

## 인증·개인정보 보호

기존 reservation-api의 `list-admin-members` 동작을 사용한다. 플랫폼 UID/JWT를 기존 `resolveCustomerIdentity()`의 실제 Account.get()으로 검증하고, 기존 `REVIEW_ADMIN_USER_IDS` allowlist와 비교한 뒤에만 Users.list()를 호출한다. 기존 audit 변수 `APPWRITE_ADMIN_USER_IDS`가 있으면 동일 UID 집합이어야 한다. 이메일/클라이언트 role만으로 권한을 부여하지 않는다.

새 경로는 주문 readiness나 DB metadata 검사를 호출하지 않는다. 요청당 신원 확인1 + Users.list1이며 per-user Preferences 추가 조회가 없다. 응답은 명시적으로 선택한 9개 필드만 포함한다. raw prefs, password/hash, token, JWT, session, identity, MFA 등은 반환하지 않는다. no-store 응답과 비민감 오류 코드만 사용하고, UI에는 일반 오류 문구를 표시한다. 키/회원 데이터를 localStorage에 보관하지 않는다. 로그아웃·인증 알림·다른 탭 변경·focus 재확인 시 이전 명단을 먼저 지우고 지연 응답을 무시한다. 조회는 10초 후 실패하며 자동 재시도하지 않는다.

## 로컬 검증

- Backend/프론트 신규 테스트 **14 PASS**, 기존 관리자 세션 테스트 포함 집중 검증 **19 PASS/0 FAIL**.
- Guest/만료/차단 JWT, 일반 회원, 관리자 ID 위조, allowlist 불일치, 임의 query/project/user 필드, SDK 권한 오류, raw 비밀 필드 제외 검증.
- 가입/연락 이메일 구분, bounded pagination, profile fallback, 요청 timeout, 인증 변경/다른 탭/focus 시 명단 제거, stale 응답 폐기, 실패를 빈 목록으로 표시하지 않음 검증.
- 전체 `npm test`: **2,197 PASS / 0 FAIL / 1 SKIP**. 기존 조건부 `KR production dist does not publish AU Chocolate pages`는 AU static 실행에서 SKIP다. 별도 KR 빌드도 통과했다. 새 파일이 Git index에 없어서 isolated builder에 복사되지 않았던 첫 실행의 B7 artifact 실패2건은 기록을 남기고, 새 파일 등록 후 artifact6 PASS와 전체 테스트 통과를 확인했다. 테스트/guard를 삭제·완화하지 않았다.
- 전체 ESLint PASS. 마지막 경로 보완 후 변경 파일 lint 및 route/admin/robots 계약16 PASS. TypeScript PASS. KR → AU(customer flag ON) 빌드 PASS. AU 회원 정적 페이지/별칭 noindex, fixture 개인정보 미포함 확인. KR 회원 페이지 미생성 확인.
- 실제 운영 회원 조회 endpoint/UI 인수는 **NOT RUN**이다. 로컬 React 렌더링·이벤트·서버 Mock 검증이며 실제 브라우저 공급자 인증을 반복하지 않았다.

## 운영 반영에 필요한 별도 승인

공식 Owner GET으로 현재 운영 `reservation-api`가 기존 member deployment `6ad5cea0eb161f62de24`이고, Function scopes에 **users.read가 없는 상태**를 재확인했다. [Appwrite 1.8.1 공식 Users API](https://github.com/appwrite/appwrite/blob/1.8.1/app/controllers/api/users.php)의 최소 조회 scope는 `users.read`다.

남은 최소 범위는 기존 Function 동적 Key scopes에 **users.read 1개 추가**, Node22 Function 정상 배포 **1회**, 최신 main으로 정상 PR 통합 후 AU Pages 정상 배포 **1회**다. 기존 main의 PR26 lockfile 수정과 고객 UI ON 환경설정을 보존해야 한다. 새 API Key/DB/Collection/Attribute/SMTP 설정·컨테이너 변경은 필요 없다. 기존 39개 환경변수, 관리자 allowlist, 회원/비회원 주문, 쿠폰/가격/알림, Renewal true/true와 Custom Cake는 보존한다.

배포 순서는 기존 운영 체크포인트 확인 → scope 최소 추가 및 새 서버 코드 배포 → frontend 통합/배포 → 관리자가 직접 로그인해 명단 확인이다. scopes 변경·Function/Pages 배포·main 통합은 이번 로컬 구현에서 실행하지 않았다. 권한이 없는 현재 운영 Function에 새 기능을 요청해 우회하지 않는다.

실패 복구 기준은 현재 Pages `d64ba5b3-8790-473b-a7d6-932f0108d92e`, 기존 member deployment `6ad5cea0eb161f62de24`와 원래 Function scopes다. 새 회원 명단만 되돌리고 기존 고객 로그인·상시 SMTP·주문 기능은 유지한다. 운영 담당자가 승인한 배포/복구 횟수 안에서만 실행해야 한다.
