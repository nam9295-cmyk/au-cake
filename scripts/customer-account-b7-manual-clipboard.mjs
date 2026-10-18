import {spawn} from 'node:child_process'
import {pathToFileURL} from 'node:url'
import {readB7ManualPacket,transferB7ManualValue} from './customer-account-b7-manual.mjs'
function run(command,input){return new Promise((resolve,reject)=>{
 const child=spawn(command,[],{stdio:['pipe','pipe','ignore'],env:{PATH:'/usr/bin:/bin'},timeout:5000});let output='',failed=false
 child.stdout.on('data',chunk=>{output+=chunk;if(Buffer.byteLength(output)>40000){failed=true;child.kill()}})
 child.once('error',()=>reject(Error('CLIPBOARD_UNAVAILABLE')))
 child.once('close',code=>code===0&&!failed?resolve(output):reject(Error('CLIPBOARD_UNAVAILABLE')))
 child.stdin.on('error',()=>{});child.stdin.end(input??'')
})}
export function createMacClipboard({execute=run}={}){
 return {write:value=>execute('/usr/bin/pbcopy',value),read:()=>execute('/usr/bin/pbpaste')}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  if(process.platform!=='darwin'||process.argv.length!==4)throw Error()
  const packet=await readB7ManualPacket(process.argv[2])
  await transferB7ManualValue({packet,action:process.argv[3],clipboard:createMacClipboard(),notify:message=>process.stdout.write(message+'\n')})
  process.stdout.write('Transfer complete. No key or request was printed.\n')
 }catch{process.stderr.write('B7 manual transfer refused or unavailable. Do not paste credentials into chat. Ask Codex to check the closed/open state.\n');process.exitCode=1}
}
