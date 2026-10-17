import type {Language} from './i18n'
export function customerOrderStatusLabel(status:string,language:Language):string {
  if(language==='ko')return status
  return ({'예약신청':'Requested','예약확정':'Confirmed','픽업완료':'Picked up','취소':'Cancelled','입금대기':'Pending payment','입금확인':'Paid','현장결제':'Pay on pick-up','환불필요':'Refund required'} as Record<string,string>)[status]||status
}
export function customerAccountCopy(language:Language) {
  const t=(en:string,ko:string)=>language==='ko'?ko:en
  return {
    title:t('Sign in or create an account','로그인 또는 계정 만들기'),
    intro:t('Save your details for your next order. You can always order as a guest.','다음 주문을 위해 정보를 저장하세요. 비회원으로도 주문할 수 있습니다.'),
    google:t('Continue with Google','Google로 계속'),email:t('Continue with Email','이메일로 계속'),guest:t('Continue as Guest','비회원으로 계속'),
    emailLabel:t('Email address','이메일 주소'),codeLabel:t('6-digit verification code','6자리 인증번호'),verify:t('Verify code','인증번호 확인'),resend:t('Resend code','인증번호 다시 받기'),changeEmail:t('Change email','이메일 변경'),
    sending:t('Sending…','발송 중…'),working:t('Please wait…','잠시 기다려 주세요…'),close:t('Close sign in','로그인 닫기'),sent:t('Check your inbox for your verification code.','이메일에서 인증번호를 확인해 주세요.'),
    cooldown:(seconds:number)=>t(`Resend in ${seconds}s`,`${seconds}초 후 재전송`),
    unavailable:t('Sign in is unavailable. You can continue as a guest.','지금은 로그인할 수 없습니다. 비회원으로 계속할 수 있습니다.'),
    error:(error:unknown)=>{
      const code=error instanceof Error?error.message:''
      if(code==='INVALID_EMAIL')return t('Enter a valid email address.','올바른 이메일 주소를 입력해 주세요.')
      if(code==='INVALID_OTP'||code==='AUTH_INVALID_OTP')return t('Check the 6-digit code and try again.','6자리 인증번호를 확인하고 다시 시도해 주세요.')
      if(code==='OTP_EXPIRED')return t('This code has expired. Request a new code.','인증번호가 만료되었습니다. 새 번호를 요청해 주세요.')
      if(code==='AUTH_RATE_LIMITED'||code==='OTP_COOLDOWN')return t('Please wait before requesting another code.','잠시 후 인증번호를 다시 요청해 주세요.')
      if(code==='ACCOUNT_SWITCH_REQUIRED')return t('An account is already signed in. Sign out explicitly before switching accounts.','이미 로그인된 계정이 있습니다. 계정을 바꾸려면 먼저 로그아웃해 주세요.')
      if(code==='INVALID_CUSTOMER_PROFILE')return t('Check your name, contact email and Australian mobile number.','이름, 연락 이메일과 호주 휴대전화 번호를 확인해 주세요.')
      return t('Sign in could not be completed. Try again or continue as a guest.','로그인을 완료하지 못했습니다. 다시 시도하거나 비회원으로 계속해 주세요.')
    },
  }
}
