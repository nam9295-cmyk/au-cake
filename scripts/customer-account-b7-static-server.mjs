// Local compiled-artifact checks: concrete HTML routes and the shipped hard 404.
// No unconditional SPA fallback, Functions proxy, credentials or remote requests.
import {createServer} from 'node:http'
import {readFile} from 'node:fs/promises'
import {resolve,extname} from 'node:path'
export async function createB7StaticServer(directory){
 const root=resolve(directory),headers=await readFile(resolve(root,'_headers'),'utf8')
 const csp=headers.split('\n').find(s=>s.trim().startsWith('Content-Security-Policy:'))?.trim().slice('Content-Security-Policy:'.length).trim()
 const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png'}
 return createServer(async(req,res)=>{
  let file,data,status=404
  try{
   const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname),candidate=resolve(root,'.'+path)
   if(candidate!==root&&!candidate.startsWith(root+'/'))throw Error()
   for(const name of [candidate,candidate+'.html',resolve(candidate,'index.html')]){
    try{data=await readFile(name);file=name;status=200;break}catch{/* Try a concrete route, never the app shell. */}
   }
  }catch{/* Invalid routes get the same hard 404. */}
  if(status!==200){file=resolve(root,'404.html');data=await readFile(file)}
  res.statusCode=status;res.setHeader('Content-Type',types[extname(file)]||'application/octet-stream')
  if(csp)res.setHeader('Content-Security-Policy',csp)
  res.setHeader('Cache-Control','no-store');res.end(data)
 })
}
