# 상시 SMTP 운영 전환 준비 — 적용 승인 전

2026-10-19. B5 단발 인수 결과는 [기존 결과](customer-account-b5-final-execution-results.md)를 그대로 인용한다. 이번 작업은 SMTP, root 설정, 컨테이너, Resend Key를 변경하거나 이메일을 발송하지 않는다. 단발 시험 Key는 폐기됐으며 재사용하지 않는다.

## 운영 영향과 승인 대상

공통 SMTP host를 활성화하면 `verygood-main`, `verygood-au`, Gallery(`69cb27ef002b63e77c53`), portfolio(`69db3ae20026cdc0c7fe`)에서 이미 ON인 Email OTP/Magic URL 및 복구·이메일 검증의 공통 host gate가 해제된다. 별도 Custom SMTP가 없는 프로젝트는 system transport를 사용한다. 내장 Console의 복구·검증·초대 메일도 영향을 받는다. 웹사이트 회원 flag OFF만으로 직접 Account API의 발송을 막지는 못한다. 기존 운영 프로젝트 Auth/ACL/Google 설정은 임의 변경하지 않는다.

B4 테스트 프로젝트 override는 별도 발신자/Key를 유지한다. B5 실제 OTP는 이 override로 전달됐으므로, 공통 fallback의 실제 배달까지 시험한 것으로 해석하지 않는다. 공통 SMTP TLS/AUTH는 두 컨테이너에서 PASS했다. 상시 적용 시 fallback 배달 확인 필요 여부와 실제 수신자/발송 1건은 별도 운영 승인에 포함해야 하며, 이번에는 보내지 않는다.

새 승인에는 다음을 한 번에 명시한다: 운영 영향 수용, 정식 root/sudo, `verygood-chocolate.com` 제한 system Sending Key 1개, SMTP 7개 변수, 동일 Appwrite1.8.1 이미지의 worker/API 각1회 재생성, 실패 시 각1회 복구, SMTP 유지 확정 조건, 발송/장애 담당자, 공통 fallback 배달 시험 여부. main 병합·사이트 배포·고객 기능 ON은 별도다.

## Credential 및 재생성

- 새 Key: Sending access, 검증된 `verygood-chocolate.com`만 허용, 이름에 운영 목적·발급일 명시. 기존 주문·리뷰/B4 Key는 유지. domain 제한은 수신자나 quota 분리가 아니다.
- Secret은 root0600 파일과 필요한 SMTP 환경에만 저장하며 Git·명령행·로그에 노출하지 않는다. 관리 기록은 Key ID/이름/권한/발급일만 남긴다. 주기 교체 및 노출 즉시 회수 담당자를 지정한다.
- 재발급 때 새 Key의 TLS/AUTH 확인 후 자격증명 교체, worker/API 순차 반영·검증, 이전 system Key만 회수한다. 오래된 Key 보존으로 무기한 중복 credential을 만들지 않는다.
- 변경은 `_APP_SMTP_HOST=smtp.resend.com`, `_APP_SMTP_PORT=465`, `_APP_SMTP_SECURE=ssl`, `_APP_SMTP_USERNAME=resend`, `_APP_SMTP_PASSWORD=<new secret>`, `_APP_SYSTEM_EMAIL_NAME=VERYGOOD%20Chocolate%20System`, `_APP_SYSTEM_EMAIL_ADDRESS=appwrite-system@verygood-chocolate.com` 7개뿐이다. 원본 `.env`의 다른 모든 바이트를 보존한다.
- 기존 root helper의 원본 `.env`/Compose/해석된 구성/컨테이너 full env/동일 이미지 아카이브/원자적 교체 및 curl health 검증을 재사용한다. 보호 백업은 매 실행 새로 만들며 이전 apply claim이나 승인을 재사용하지 않는다.
- 이미지 pull/upgrade 없이 `appwrite-worker-mails` → `appwrite`만 `--no-deps --no-build --pull never --force-recreate --timeout 30`한다. 정확한 Compose 경로·서비스·image digest는 실행 직전 승인 manifest로 고정한다. 다른 컨테이너·DB·Function은 제외한다.
- API 재생성 동안 일시적 API 중단이 생길 수 있다. 이전 단발 노출297.793초는 API 중단 시간 측정값이 아니다. 컨테이너별 시작/health 시간을 기록하고 API public curl200+내부 health가60초 이내 복원되지 않으면 원복한다.

기존 단발 helper는480초에 무조건 복구하고600초 상한이 있다. **이 helper를 그대로 상시 적용용으로 실행하거나 타이머를 임의 해제하지 않는다.** 별도 운영 승인 후 기존 도구에 최소한의 유지 확정 계약을 추가해야 한다. 검증 전에는 server-side rollback이 독립적으로 작동하고, 모든 운영 gate PASS와 명시적 유지 확정 이후에만 예약 복구 해제를 허용한다. 이 전환은 아직 구현/실행하지 않았다.

## Quota·남용·중단 정책 제안

최근 B5 공식 Console 관측치는 일5/100·월87/3000, 팀10req/s, verified domain2/3이다. 이는 현재 잔량 보장이 아니며 상시 적용 직전에 새 집계가 필수다. [Resend 공식 quota](https://resend.com/docs/knowledge-base/account-quotas-and-limits)는 Free100/UTC일·3000/월이며 rate limit은 Key/도메인별이 아닌 팀 전체 공유다. 키 분리만으로 주문 메일 여유분을 강제 예약할 수 없다. 단일 반송률/스팸률 문제도 팀 발송에 영향을 줄 수 있다.

Appwrite1.8.1 `_APP_OPTIONS_ABUSE=enabled`와 route별 email/IP/user 기준 제한을 유지한다. 기존 source 점검의 OTP/복구/검증10회/시간, Magic URL60회/시간은 다수 IP·다수 주소의 총량을 막지 못한다. 브라우저 재전송 cooldown도 직접 API 우회에 대한 전역 제한이 아니다. 수신자 allowlist가 입증됐다고 주장하지 않는다.

승인할 초기 운영 정책 제안:

1. 적용 전 일 잔량50건 이상·월 잔량1000건 이상을 확보하고, 예상 고객량이 맞지 않으면 유료 용량/운영 분리 검토 후 시작한다. 이 수치는 운영 판단 기준이며 provider 강제 예약이 아니다.
2. 초기에는 담당자가 집계를 상시 관찰한다. 예기치 않은 system 발송, baseline 대비5분10건 초과 증가, 일 사용량50건 도달, 월80% 도달, 새429/SMTP AUTH·TLS 오류, queue 증가·기존 failed1 증가를 발견하면 신규 OTP 진입을 우선 차단하고 운영 담당자에게 통보한다. 정확한 임계값과 담당자 수락이 적용 전 필수다.
3. 전체 quota 소진 위험·계정 악용이 지속되면 새로운 system Key만 회수하고 공통 설정을 승인된 백업으로 복구한다. 기존 주문/리뷰/B4 Key를 건드리지 않는다. 공통 SMTP OFF는 다른 프로젝트·Console 이메일 인증에도 영향을 주므로 공지/복구 담당자와 함께 수행한다.
4. 메일 요청 실패를 자동 반복 발송하지 않는다. UI는 명확한 실패와 비회원 주문 진행을 제공한다. API 장애 시 고객 기능 flag를 OFF하고 기존 비회원 주문 동작을 보호한다.

이 정책은 기존 Console/집계/API와 운영 절차를 이용하며 새로운 relay나 프레임워크를 추가하지 않는다. **관측형 중단은 발송 전 강제 차단을 보장하지 않는다.** 공유 Free quota에서 이 잔여 위험을 수용할 수 없다면 용량/인스턴스/메일 계정 분리를 먼저 결정한다.

## 복구 및 종료 근거

원본 바이트를 원자적으로 복구하고 API·mail worker 모두 원래 환경과 동일 image로 복원한 뒤 최종 public curl200·내부 health를 확인한다. 큐/processing/failed는 건수만 비교하며 failed1 재시도·삭제·내용 열람을 하지 않는다. 운영4개+Console의 현재 semantic baseline, 무관 컨테이너 ID/start time, G/H 및 운영 고객 권한 불변을 확인한다. 과거 AU/Gallery raw 차이는 UNVERIFIED로 보존한다.

상시 적용은 아직 승인·실행하지 않았다. 새 Key 발급, 유지 확정 도구 변경, 실제 fallback 발송, root/서비스 변경이 이번 준비 결과에 포함됐다고 보고하지 않는다.
