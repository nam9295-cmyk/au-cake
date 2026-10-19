// Never use ps command/comm/title columns: npm may replace them with credential-bearing argv.
import {execFileSync} from 'node:child_process'
import {basename} from 'node:path'
import {pathToFileURL} from 'node:url'
const labels=new Set(['node','python3','python','ssh','Google Chrome','zsh','bash'])
export function safeProcessSummary(rows){
 if(!Array.isArray(rows))throw Error('INVALID_PROCESS_INVENTORY')
 return rows.filter(r=>Number.isSafeInteger(r.pid)&&r.pid>0).map(r=>({pid:r.pid,executable:labels.has(basename(String(r.path)))?basename(String(r.path)):'other'}))
}
export function inspectProcessExecutable(pid){
 if(!Number.isSafeInteger(pid)||pid<1)throw Error('INVALID_PROCESS_ID')
 const source=`import sys,os,ctypes,json\npid=int(sys.argv[1])\npath=''\nif sys.platform=='darwin':\n lib=ctypes.CDLL('/usr/lib/libproc.dylib');buf=ctypes.create_string_buffer(4096)\n if lib.proc_pidpath(pid,buf,4096)>0:path=buf.value.decode('utf8','replace')\nelif sys.platform.startswith('linux'):\n try:path=os.readlink('/proc/'+str(pid)+'/exe')\n except OSError:pass\nprint(json.dumps([{'pid':pid,'path':path}]) if path else '[]')\n`
 const result=execFileSync('python3',['-c',source,String(pid)],{encoding:'utf8',timeout:5000,stdio:['ignore','pipe','ignore']})
 return safeProcessSummary(JSON.parse(result))
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){
 try{if(process.argv[2]!=='--pid')throw Error();console.log(JSON.stringify(inspectProcessExecutable(Number(process.argv[3]))))}catch{console.error('Process executable inspection failed; arguments and titles were not read.');process.exitCode=1}
}
