# VERYGOOD AU Customer Account — 개인정보 및 계정 삭제 운영안

2026-10-17. 자동 회원탈퇴 API는 1차 범위에 없다. 아래는 운영 담당자의 검토·승인이 필요한 절차이며 실제 계정·주문 변경을 실행하지 않았다. 적용 법률, 기록별 보존 목적·기간과 담당자는 운영 활성화 전에 확정해야 한다.

## 사용자 안내

`/account`의 EN/KO 안내는 기존 Contact Us 경로를 사용한다.

- EN: “For account deletion or privacy requests, please contact us. Some order and accounting records may be retained where required.”
- KO: “계정 삭제 또는 개인정보 관련 요청은 Contact Us로 문의해 주세요. 일부 주문·회계 기록은 필요한 기간 동안 보관될 수 있습니다.”

현재 Contact Us는 기존 Instagram 문의 링크다. 문의 접수 단계에서 OTP·비밀번호·전체 주문정보·신분증을 공개 댓글/DM으로 요구하지 않는다. 운영자는 별도로 승인한 비공개 본인 확인 채널을 제공해야 한다. 이메일 또는 전화번호 일치만으로 본인임을 인정하거나 주문을 계정에 귀속하지 않는다. 전용 문의 담당자·안전한 확인 채널과 답변 절차가 확정되지 않으면 기능을 운영 활성화하지 않는다.

## 계정과 주문을 분리한다

| 대상 | 처리 원칙 |
| --- | --- |
| Appwrite Account/identities/sessions | 로그인 자격과 계정 이름·로그인 이메일. Account prefs의 `verygoodAuCustomer`에는 주문 연락처/언어를 저장한다. 계정 삭제 요청 검토 대상이다. |
| reservations.customerUserId | 로그인 상태에서 생성한 새 일반 주문의 조회 권한 연결이다. 주문 연락처나 법적 보존 기록 자체가 아니다. |
| 주문 연락처/가격 snapshot·쿠폰·결제·알림 원장 | 거래 당시의 독립 기록. 프로필 수정으로 변경하지 않는다. 필요한 보존 목적과 기한을 개별 검토한다. 계정 삭제가 주문 취소·환불·모든 기록의 즉시 삭제를 뜻하지 않는다. |
| Custom Cake/Kids Class | 1차 회원 소유권 연동 대상이 아니다. 기존 운영 자료의 요청 처리는 별도 승인·기존 절차로 검토한다. 자동 회원 연결은 없다. |

운영자는 기록 종류별 목적, 법적 근거/의무, 보존 시작점·기한, 접근 권한, 백업·내보내기·수탁자/메일 사본 처리와 삭제 책임자를 기록한다. 불필요한 정보는 승인된 정책에 따라 삭제 또는 비식별화한다. 이 문서는 모든 기록에 하나의 보존 기간을 강제하지 않는다. 해당 사업자의 법 적용과 회계 보존 의무는 담당자/회계 전문가가 확인한다. 개인정보가 더 이상 필요하지 않은 경우의 처리와 법률상 보존 예외는 [OAIC APP 11](https://www.oaic.gov.au/privacy/australian-privacy-principles/australian-privacy-principles-guidelines/chapter-11-app-11-security-of-personal-information)을 참고한다. 사업 기록별 보존 요건은 [ATO 사업 기록 안내](https://www.ato.gov.au/api/public/content/0-53cc7a8e-0668-4c9d-95d7-eb841eb09c04)를 검토한다.

## 승인된 관리자의 계정 삭제 요청 처리

1. 요청 식별번호를 발급하고 최소 정보로 비공개 본인 확인을 수행한다. 현재 인증된 로그인 계정의 검증된 Appwrite `$id`를 확정한다. 수정 가능한 주문 연락 이메일이나 제3자의 주문번호만으로 대상을 정하지 않는다. 관리자 계정이면 관리자 접근/다른 서비스 영향도 별도 검토한다.
2. 담당자 승인을 받아 거래 이행·환불·분쟁·법적/회계 보존 대상과 삭제 가능한 profile/연락처 범위를 구분한다. 주문 snapshot은 프로필을 수정했다는 이유로 소급 덮어쓰지 않는다. 요청자에게 남는 기록의 이유와 범위를 안내한다.
3. **실제 변경 승인을 받은 운영자만** 계정을 block하고 세션/관련 인증 자격을 폐기한다. 고객 ownership 생성·조회가 중단되는지 실제 서버에서 확인한다. 이미 실행 중인 주문/쿠폰 transaction·claim·재시도·reconciliation 작업이 끝나는 quiescence를 확보한다. 단순 로그아웃만으로 모든 in-flight 작업이 끝났다고 가정하지 않는다.
4. 정확히 검증한 UID와 연결된 reservations를 관리자 전용으로 식별하고, 승인 범위에서 **owner 연결을 먼저 해제**한다. 사용자 계정 삭제 전에 pending/reconciliation 재생성 가능성을 점검하고 같은 UID로 연결된 주문이 0건인지 다시 확인한다. 주문 snapshot·가격·예약번호·회계 기록은 별도 보존 결정에 따른다. 게스트/타인 주문을 수정하지 않는다.
5. 그 뒤 승인된 Account/identity/profile 삭제를 수행한다. Appwrite에서 사용자 지정 UID 재사용이 가능하므로, hard delete를 먼저 하면 재생성된 같은 UID가 보존 주문을 조회할 위험이 있다. owner unlink와 quiescence가 검증되지 않으면 hard delete를 진행하지 않고 block 상태로 원인을 보고한다. 이를 자동 처리하는 운영 스크립트는 이번 개발에 포함되지 않는다.
6. 기존 JWT/세션은 거부되고 MY ORDERS 접근이 종료되는지 검증한다. 같은 이메일 또는 같은 UID로 새 테스트 계정을 만든 격리 검증에서도 이전 주문이 보이지 않아야 한다. 이번 로컬 테스트는 `customerUserId=null`인 보존 주문이 같은 이메일/UID의 새 fixture에서 제외되는 것까지 증명한다. 실제 provider의 폐기/차단/JWT 동작은 별도 격리 gate다.
7. 승인된 정책에 따라 불필요한 profile·수탁자 사본·내보내기를 정리하고, 백업 보존/복구 시 삭제 요청을 재적용하는 절차를 기록한다. 운영 변경 감사 기록에는 최소 식별자·승인·시각·범위·확인 결과만 보관하고 OTP/JWT/불필요한 연락처를 남기지 않는다. 요청자에게 완료 결과와 보존 기록을 비공개로 알린다.

계정 삭제 후 계정 기반 주문 조회 권한은 종료된다. 기존 예약번호+전화번호 조회는 서비스의 독립적인 기존 기능이므로 자동으로 폐쇄되지 않는다. 남는 주문 기록과 해당 조회 방법을 안내하고, 추가 개인정보 요청은 보존 의무와 기존 조회 정책을 함께 검토한다. 재가입·같은 이메일 로그인으로 옛 주문을 자동 연결하지 않는다.

## 로컬 브라우저 데이터

Google 왕복을 위한 checkout draft는 같은 탭 sessionStorage에 최대 30분 유효한 versioned snapshot으로 저장한다. 복원 시 주문서가 적용된 뒤 해당 draft/return metadata를 제거한다. TTL이 지나면 복원하지 않지만 탭이 열린 채 남은 만료 항목을 주기적으로 삭제하는 별도 job은 없다. 탭 종료 시 브라우저의 sessionStorage 수명에 따른다. 토큰/JWT/OTP는 저장하지 않는다. auth 변경의 탭간 알림은 UUID nonce만 사용한다. 기본 장바구니는 기존 localStorage 정책을 유지한다.
