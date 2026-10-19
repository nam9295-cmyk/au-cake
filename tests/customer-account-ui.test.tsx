import React from 'react'
import test from 'node:test'
import assert from 'node:assert/strict'
import {renderToStaticMarkup} from 'react-dom/server'
import * as provider from '../src/CustomerAccountProvider'
import * as dialog from '../src/components/CustomerSignInDialog'

test('disabled provider renders existing checkout without making any Account or health calls',()=>{
  const Provider=Reflect.get(provider,'CustomerAccountProvider')
  assert.equal(typeof Provider,'function')
  let calls=0
  const auth=new Proxy({}, {get(){calls++;throw Error('disabled')}})
  const orders=new Proxy({}, {get(){calls++;throw Error('disabled')}})
  const html=renderToStaticMarkup(<Provider enabled={false} auth={auth} orderService={orders}><form><input name="customerName" defaultValue="Already typed"/></form></Provider>)
  assert.match(html,/Already typed/);assert.equal(calls,0)
})
test('optional bilingual dialog offers Google, Email OTP and guest without passwords',()=>{
  const Dialog=Reflect.get(dialog,'CustomerSignInDialog')
  assert.equal(typeof Dialog,'function')
  for(const language of ['en','ko']) {
    const html=renderToStaticMarkup(<Dialog language={language} auth={{}} onAuthenticated={()=>{}} onGoogle={async()=>{}} onClose={()=>{}}/>)
    assert.match(html,language==='en'?/Continue with Google/:/Google로 계속/)
    assert.match(html,language==='en'?/Continue with Email/:/이메일로 계속/)
    assert.match(html,language==='en'?/Continue as Guest/:/비회원으로 계속/)
    assert.doesNotMatch(html,/type="password"|magic.?link|Passkey|Apple/)
  }
})
