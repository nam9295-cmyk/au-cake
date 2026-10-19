import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'node:http'
import {Client,Functions,ExecutionMethod} from 'appwrite'
test('installed browser SDK serializes execution signature in payload.headers and xpath as path',async()=>{
 let observed
 const server=createServer(async(req,res)=>{let text='';for await(const chunk of req)text+=chunk;observed={url:req.url,method:req.method,project:req.headers['x-appwrite-project'],body:JSON.parse(text)};res.setHeader('Content-Type','application/json');res.end(JSON.stringify({responseStatusCode:200,responseBody:'{}'}))})
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
 try{
 const client=new Client().setEndpoint(`http://127.0.0.1:${server.address().port}/v1`).setProject('verygood-au-account-test')
 const headers={'x-b7-timestamp':'1792281600000','x-b7-nonce':'b7000003-0000-4000-8000-000000000003','x-b7-signature':'local-contract-proof-not-a-real-signature'}
 await new Functions(client).createExecution({functionId:'ca-test-reservation-api',body:'{"action":"health"}',async:false,xpath:'/',method:ExecutionMethod.POST,headers})
 assert.deepEqual(observed,{url:'/v1/functions/ca-test-reservation-api/executions',method:'POST',project:'verygood-au-account-test',body:{body:'{"action":"health"}',async:false,path:'/',method:'POST',headers}})
 }finally{await new Promise(resolve=>server.close(resolve))}
})
