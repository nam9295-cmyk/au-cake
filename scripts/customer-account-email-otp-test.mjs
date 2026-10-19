// Small policy used by the one-shot native OTP monitor and session cleanup.
export const OTP_TRIAL_USER='6ad38e4e0ffd5f810e23'
export const OTP_TRIAL_EMAIL='nam9295@gmail.com'
const reject=()=>{throw Error('OTP_TRIAL_SESSION_REJECTED')}
function validate(rows,startedAt,providers){
 if(!Array.isArray(rows)||!Number.isFinite(startedAt))reject()
 return rows.map(s=>{
  if(s?.userId!==OTP_TRIAL_USER||!providers.includes(s.provider)||!Number.isFinite(Date.parse(s.createdAt))||Date.parse(s.createdAt)<startedAt||!/^[-\w.]{1,36}$/.test(s.id||''))reject()
  return {id:s.id,userId:s.userId,provider:s.provider,createdAt:s.createdAt}
 })
}
export function assertOtpTrialSessions(rows,{phase,startedAt}){
 if(!['otp','google'].includes(phase))reject()
 return validate(rows,startedAt,[phase==='otp'?'token':'google'])
}
export function trialSessionsForCleanup(rows,startedAt){return validate(rows,startedAt,['token','google'])}
