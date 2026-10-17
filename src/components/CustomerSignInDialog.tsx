import {useEffect,useRef,useState} from 'react'
import type {Language} from '../lib/i18n'
import type {CustomerAuth} from '../lib/customer-auth'
import type {CustomerIdentity} from '../lib/customer-account-types'
import {customerAccountCopy} from '../lib/customer-account-copy'

export function CustomerSignInDialog({auth,language='en',available=true,onAuthenticated,onGoogle,onClose}:{auth:CustomerAuth;language?:Language;available?:boolean;onAuthenticated:(identity:CustomerIdentity)=>void;onGoogle:()=>Promise<void>;onClose:()=>void}) {
  const copy=customerAccountCopy(language),dialog=useRef<HTMLDialogElement>(null),active=useRef(false),running=useRef(false)
  const [email,setEmail]=useState(''),[code,setCode]=useState(''),[challenge,setChallenge]=useState<{userId:string;expire:string}|null>(null)
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[retryAt,setRetryAt]=useState(0),[now,setNow]=useState(Date.now)
  useEffect(()=>{
    active.current=true
    const element=dialog.current,trigger=document.activeElement as HTMLElement|null
    element?.showModal()
    return ()=>{active.current=false;element?.close();trigger?.focus()}
  },[])
  useEffect(()=>{if(!retryAt)return;const timer=setInterval(()=>setNow(Date.now()),1000);return ()=>clearInterval(timer)},[retryAt])
  async function run(operation:()=>Promise<void>) {
    if(running.current||!available)return
    running.current=true;setBusy(true);setError('')
    try{await operation()}catch(caught){if(active.current){setError(copy.error(caught));if(caught instanceof Error&&['AUTH_RATE_LIMITED','OTP_COOLDOWN'].includes(caught.message))setRetryAt(Date.now()+60000)}}
    finally{running.current=false;if(active.current)setBusy(false)}
  }
  async function send(){await run(async()=>{const sent=await auth.sendEmail(email);if(active.current){setChallenge(sent);setRetryAt(sent.retryAt);setNow(Date.now());setCode('')}})}
  const seconds=Math.max(0,Math.ceil((retryAt-now)/1000))
  return <dialog ref={dialog} className="customer-account-dialog" aria-labelledby="customer-signin-title" onCancel={event=>{event.preventDefault();onClose()}} onClick={event=>{if(event.target===event.currentTarget)onClose()}}>
    <button className="customer-account-close" type="button" aria-label={copy.close} onClick={onClose}>×</button>
    <h2 id="customer-signin-title">{copy.title}</h2><p>{copy.intro}</p>
    {!available&&<p role="status">{copy.unavailable}</p>}
    <button className="secondary-button" type="button" disabled={busy||!available} onClick={()=>void run(onGoogle)}>{copy.google}</button>
    <form onSubmit={event=>{event.preventDefault();if(challenge)void run(async()=>{const identity=await auth.verifyEmail({userId:challenge.userId,code});if(active.current)onAuthenticated(identity)});else void send()}}>
      <label>{copy.emailLabel}<input type="email" autoComplete="email" maxLength={120} required value={email} readOnly={!!challenge} onChange={event=>setEmail(event.target.value)} disabled={busy||!available}/></label>
      {challenge&&<><p>{copy.sent}</p><label>{copy.codeLabel}<input autoFocus type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={event=>setCode(event.target.value.replace(/\D/g,''))} disabled={busy||!available}/></label></>}
      <button className="primary-button" type="submit" disabled={busy||!available}>{busy?copy.working:challenge?copy.verify:copy.email}</button>
      {challenge&&<div className="customer-account-inline"><button type="button" disabled={busy||seconds>0||!available} onClick={()=>void send()}>{seconds?copy.cooldown(seconds):copy.resend}</button><button type="button" disabled={busy} onClick={()=>{setChallenge(null);setCode('');setError('')}}>{copy.changeEmail}</button></div>}
    </form>
    <p role="status" aria-live="polite">{error}</p>
    <button className="customer-account-guest" type="button" onClick={onClose}>{copy.guest}</button>
  </dialog>
}
