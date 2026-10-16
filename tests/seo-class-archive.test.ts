import test from 'node:test'
import {createElement} from 'react'
import assert from 'node:assert/strict'
import {renderToStaticMarkup} from 'react-dom/server'
import {ClassesPage} from '../src/pages/ClassesPage'
test('SEO-07 AU visible classes are archived, with enquiries and no old price recruitment',()=>{
 for(const language of ['en','ko'] as const){
  const html=renderToStaticMarkup(createElement(ClassesPage,{navigate:()=>{},language,setLanguage:()=>{},cartItemCount:0}));
  assert.match(html, /archive|지난 프로그램/i);assert.doesNotMatch(html,/AUD.*99|Daily Spring|Basic Cupcakes/)
  assert.match(html,/href="\/custom-cakes"/)
 }
})
