import {readFile,lstat} from 'node:fs/promises'
// Caller supplies known protected values directly; findings never echo a secret.
export async function scanB7Files({paths,secrets=[]}){
 if(!Array.isArray(paths)||!Array.isArray(secrets)||secrets.some(s=>typeof s!=='string'||s.length<8))throw Error('B7_SECRET_SCAN_CONFIGURATION_REJECTED')
 let files=0,findings=0
 for(const path of paths){
  const info=await lstat(path);if(!info.isFile()||info.isSymbolicLink())throw Error('B7_SECRET_SCAN_FILE_REJECTED')
  const body=await readFile(path);files++
  if(secrets.some(secret=>body.includes(Buffer.from(secret))))findings++
 }
 return {clean:findings===0,files,filesWithProtectedValue:findings}
}
