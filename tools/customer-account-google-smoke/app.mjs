import {Account,Client} from 'appwrite'
import {TEST_ORIGIN,TEST_ENDPOINT,TEST_PROJECT,googleSessionOptions,publicAccount,publicAuthError} from './contract.mjs'
// Strip all callback query/fragment values before any UI or diagnostic output.
if(location.search||location.hash)history.replaceState(null,'',location.pathname)
const status=document.querySelector('#status'),identity=document.querySelector('#identity'),result=document.querySelector('#result')
const login=document.querySelector('#login'),refresh=document.querySelector('#refresh'),logout=document.querySelector('#logout')
const account=new Account(new Client().setEndpoint(TEST_ENDPOINT).setProject(TEST_PROJECT))
let available=false,busy=false,windowConfig={enabled:false,endsAt:null}
function controls(signedIn=false){login.disabled=busy||signedIn||!available||!windowConfig.enabled||Date.now()>=Date.parse(windowConfig.endsAt);refresh.disabled=busy;logout.disabled=busy||!signedIn}
async function check(){
 busy=true;identity.textContent='';controls();status.textContent='Checking session…'
 try{const current=publicAccount(await account.get());status.textContent='Signed in';identity.textContent=JSON.stringify(current,null,2);result.textContent='Account.get() succeeded';busy=false;controls(true);return true}
 catch(error){const safe=publicAuthError(error);available=safe.type!=='general_service_disabled';status.textContent=available?'Signed out':'Authentication stopped';result.textContent=JSON.stringify(safe);busy=false;controls(false);return false}
}
login.addEventListener('click',()=>{if(login.disabled||location.origin!==TEST_ORIGIN)return;busy=true;controls();identity.textContent='';status.textContent='Opening Google…';account.createOAuth2Session(googleSessionOptions(location.origin))})
refresh.addEventListener('click',()=>void check())
logout.addEventListener('click',async()=>{
 if(logout.disabled)return;busy=true;identity.textContent='';controls();status.textContent='Signing out…'
 try{await account.deleteSession({sessionId:'current'});const retained=await check();result.textContent=retained?'Logout verification failed':'Logout verified: Account.get() denied';}
 catch(error){status.textContent='Logout request failed';result.textContent=JSON.stringify(publicAuthError(error));busy=false;controls(false)}
})
if(location.origin!==TEST_ORIGIN){status.textContent='Use the authorised test hostname';refresh.disabled=true;logout.disabled=true;login.disabled=true}
else{
 try{const r=await fetch('/test-window.json',{cache:'no-store'});windowConfig=await r.json();available=windowConfig.enabled===true&&Date.parse(windowConfig.endsAt)>Date.now()}catch{/* closed by default */}
 if(location.pathname==='/failed/')result.textContent='Google authentication returned without completing. No order was created.'
 await check();setInterval(()=>controls(status.textContent==='Signed in'),1000)
}
