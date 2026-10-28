// Public presentation only: consumed by the AU frontend and static generator, never order validation.
import { renewalPickupCopy } from "./au-renewal-pickup-policy.js";
import { RENEWAL_OFFERS, MOCHI_DISPLAY_FLAVOURS, mochiFlavourName } from "./au-renewal.js";
import { RENEWAL_NAV, RENEWAL_CARDS, HALLOWEEN_MERINGUE_CARD, HALLOWEEN_ORDER_DEADLINE } from "./au-renewal-catalog.js";
const escape = (s) => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = cents => (cents / 100).toFixed(2);
const finishName = key => ({basic:'Basic','extra-chocolate':'Extra Chocolate','vanilla-fresh-cream':'Vanilla Fresh Cream','chocolate-buttercream':'Chocolate Buttercream'}[key] || key);
const cards = Object.values(RENEWAL_CARDS).flat();
// Measured from the existing public assets; tests verify against decoded files.
const imageDimensions = {'halloween-meringue':[1080,1440],pave:[1080,1012],'gateau-loaf':[1080,1012],'brownie-whole':[1080,1012],'brownie-loaf':[1024,1024],cookies:[1216,864],mochi:[1080,1012],almond:[1080,1012],'pave-chocolate':[1080,1012],eiffel:[1080,1012],'gateau-cupcakes':[480,313],'brownie-cupcakes':[912,1152],smore:[480,320]};
export function seoRobots(config) {
  if (config.noindex) return 'noindex, nofollow';
  return config.robots || 'index, follow';
}
const summaries = {
  'halloween-meringue': 'Halloween 2026 Meringue Pops: packs of 3, 6, 12 or 24. Melrose Park, Sydney pickup Wednesday, Friday, Saturday and Sunday, ending 1 November 2026. Order at least 24 hours ahead; final orders 31 October at 1pm (Sydney).',
  pave: 'Pavé chocolate whole cake in three sizes with dark or milk chocolate. Made to order for celebrations in Sydney.',
  'gateau-loaf': 'Signature Gâteau chocolate loaf with Basic, Extra Chocolate or Vanilla Fresh Cream finishes. Pickup in Melrose Park, Sydney.',
  'brownie-whole': 'Brownie Basque cheesecake in whole cake and loaf forms, with optional Vanilla Fresh Cream. Made to order in Sydney.',
  'brownie-loaf': 'Brownie Basque cheesecake loaf with optional Vanilla Fresh Cream. Pickup in Melrose Park, Sydney.',
  cookies: 'A six-cookie set: three Chocolate Chip and three Double Chocolate. Photos and product introduction; reservations await price approval.',
  mochi: 'Six Chocolate Mochi flavours in Sydney: choose singles or build a four-piece gift box with free box packaging. Pickup in Melrose Park.',
  almond: 'Almond Chocolate in 80g packs, a six-pack 5+1 bundle or a black tub with two 80g packs. Pickup in Melrose Park, Sydney.',
  'pave-chocolate': 'Pavé Chocolate in a 100g heart tin, individually or as a six-tin 5+1 bundle. A chocolate gift for pickup in Melrose Park, Sydney.',
  eiffel: 'Eiffel Tower Chocolate in six-piece packs or a 5+1 bundle of six packs. Chocolate gifts for pickup in Melrose Park, Sydney.',
  'gateau-cupcakes': 'Gâteau Cupcakes in six or twelve, with Basic, Vanilla Fresh Cream or Chocolate Buttercream finishes. Made for Sydney celebrations.',
  'brownie-cupcakes': 'Brownie Basque Cupcakes in six or twelve, with Basic or Vanilla Fresh Cream. Product introduction; reservations await price approval.',
};
const mochiTerms = 'Choose exactly four pieces for each gift box: the price is the sum of the selected singles and box packaging is free. Order several identical boxes, different box selections, or mixed singles. Optional individual packaging for singles is AUD 0.50 per piece; no free gift box applies to singles.';
export const MOCHI_PUBLIC_INFORMATION = {
  en: ['Original: 80g. Fruit and butter & red bean: at least 85g each; fruit weight varies.', 'Keep refrigerated. Best enjoyed on the day. Recommended refrigerated storage: up to 3 days.', 'Contains milk and soy. Made in a facility that also handles almonds, wheat, eggs, sesame and peanuts.'],
  ko: ['오리지널 80g. 과일·앙버터는 개당 85g 이상이며 과일 상태에 따라 중량이 달라집니다.', '냉장 보관해주세요. 당일 섭취를 권장하며, 냉장 보관은 최대 3일 권장합니다.', '우유·대두 함유. 아몬드·밀·계란·참깨·땅콩을 취급하는 시설에서 함께 제조합니다.'],
};
export const CLASS_ARCHIVE_COPY = {
  en: {title:'Kids Cake Classes · Archive & Enquiries',intro:'Our 26 September–12 October 2026 school holiday program has ended. Next school holiday dates and prices are not yet confirmed.',courses:'Explore Basic · 1-tier and Advanced · 2-tier cake classes through our Custom Cake hub. Enquiries are welcome; this is not an open booking offer.',link:'Class enquiries and Custom Cake',archive:'Past school holiday cake decorating'},
  ko: {title:'키즈 케이크 클래스 · 지난 프로그램 및 문의',intro:'2026년 9월 26일–10월 12일 방학 프로그램은 종료되었습니다. 다음 방학 일정과 가격은 아직 확정되지 않았습니다.',courses:'Custom Cake에서 Basic · 1단 및 Advanced · 2단 케이크 클래스를 살펴보고 문의해주세요. 현재 신규 예약 모집 중인 프로그램은 아닙니다.',link:'클래스 문의 및 Custom Cake',archive:'지난 방학 케이크 데코레이팅'},
};
export function classArchiveSeo(siteUrl) {
  const c=CLASS_ARCHIVE_COPY.en;
  return {title:c.title+' | verygood chocolate',description:c.intro,canonical:siteUrl+'/classes',robots:'index, follow',structuredData:[{'@type':'WebPage',name:c.title,description:c.intro,url:siteUrl+'/classes'}],fallbackHtml:`<main><h1>${escape(c.title)}</h1><p>${escape(c.intro)}</p><h2>${escape(c.archive)}</h2><p>${escape(c.courses)}</p><a href="/custom-cakes">${escape(c.link)}</a></main>`};
}
function selections(card) {
  if (card.id==='mochi') return MOCHI_DISPLAY_FLAVOURS.map(f=>({name:`${mochiFlavourName(f.id)} · 1 piece (single)`,price:f.priceCents,url:card.href}));
  return card.offers.flatMap(id=>{
    const p=RENEWAL_OFFERS[id];
    if(p.price===null || p.provisional) return [];
    return Object.entries(p.sizes || {'':p.price}).flatMap(([size,base])=>
      Object.entries(p.finishes || {basic:base}).map(([finish,price])=>({name:[p.name,size,finishName(finish)].filter(Boolean).join(' · '),price,url:card.href})));
  });
}
function description(card) {
  return card.id==='smore' ? `S’more Sticks: 6 for AUD ${money(RENEWAL_OFFERS['smore-6'].price)} or 12 for AUD ${money(RENEWAL_OFFERS['smore-12'].price)}. Chocolate-coated marshmallow treats for Sydney celebrations.` : summaries[card.id];
}
function imageConfig(siteUrl, card) {
  return card ? {image:siteUrl+card.image,imageType:'image/webp',imageWidth:imageDimensions[card.id][0],imageHeight:imageDimensions[card.id][1],imageAlt:card.en} : {image:siteUrl+'/og-image.jpg',imageType:'image/jpeg',imageWidth:1200,imageHeight:630,imageAlt:'VERYGOOD Chocolate Atelier Sydney'};
}
function imageHtml(card) {
  const [width,height]=imageDimensions[card.id];
  return `<img src="${card.image}" alt="${escape(card.en)}" width="${width}" height="${height}" style="max-width:100%;height:auto" />`;
}
function cardFacts(card) {
  const choices=selections(card);
  return `${imageHtml(card)}<h2><a href="${card.href}">${escape(card.en)}</a></h2><p>${escape(description(card))}</p>${choices.length?`<ul>${choices.map(c=>`<li>${escape(c.name)} — AUD ${money(c.price)}</li>`).join('')}</ul>`:'<p>Reservations are not available until the sale price is approved.</p>'}${card.id==='mochi'?`<p>${mochiTerms}</p><p>Please allow at least 24 hours before pickup.</p>${MOCHI_PUBLIC_INFORMATION.en.map(s=>`<p>${escape(s)}</p>`).join('')}`:''}${card.offers.some(id=>RENEWAL_OFFERS[id].cream)?'<p>Optional Vanilla Fresh Cream +AUD 10.00.</p>':''}${card.id.includes('cupcakes')?'<p>Optional individual packaging AUD 0.50 per cupcake, waived when the eligible cupcake subtotal reaches AUD 100.</p>':''}`;
}
export function renewalSeoPages(siteUrl, content) {
  const pages={};
  const nav=RENEWAL_NAV.map(n=>`<a href="${n.href}">${escape(n.en)}</a>`).join(' · ');
  const pickup=renewalPickupCopy('en');
  const categoryDescriptions={
    '/':'Made-to-order cakes and chocolate creations in Sydney. Explore our menu, custom cakes and business enquiries.',
    '/cakes':'Explore Pavé whole cake, Gâteau loaf, Brownie Basque whole cake and loaf, and Levain Cookies. Cake & Bake in Melrose Park, Sydney.',
    '/chocolates':'Explore six-flavour Chocolate Mochi, Almond Chocolate, Pavé heart tins and Eiffel Tower Chocolate. Gift selections in Melrose Park, Sydney.',
    '/celebrate':'Gâteau Cupcakes, Brownie Basque Cupcakes and S’more Sticks for celebrations in Sydney. Explore pack sizes and current reservation availability.',
    '/custom-cakes':'Explore bespoke celebration cakes and Basic one-tier or Advanced two-tier class enquiries in Sydney. Share your design, date and servings.',
    '/business':'Cakes and chocolate gifts for corporate events, café supply enquiries and menu consulting in Sydney. Explore VERYGOOD business services.',
  };
  for(const item of [{href:'/',en:'VERYGOOD Sydney'},...RENEWAL_NAV,...cards,HALLOWEEN_MERINGUE_CARD]) {
    const path=item.href.split('?')[0];if(pages[path])continue;
    const siblings=[...cards,HALLOWEEN_MERINGUE_CARD].filter(c=>c.href.split('?')[0]===path);
    const list=RENEWAL_CARDS[path.slice(1)] || (path==='/'?cards:[]);
    const product=siblings.length>0;
    const name=siblings.length>1?'Brownie Basque Cheesecake · Whole & Loaf':item.en;
    const desc=product?description(item):categoryDescriptions[path];
    const canonical=siteUrl+(path==='/'?'':path);
    const page={title:`${name}${item.id==='halloween-meringue'?' in Sydney':''} | verygood chocolate`,description:desc,canonical,robots:'index, follow',noindex:false,output:'directory',extensionlessAlias:path!=='/',...imageConfig(siteUrl,product?item:null),structuredData:[],fallbackHtml:''};
    if(product){
      const choices=siblings.flatMap(selections);
      page.ogType=choices.length?'product':'website';
      page.structuredData.push({'@type':choices.length?'Product':'WebPage',name,description:desc,url:canonical,image:siblings.map(c=>siteUrl+c.image),...(choices.length?{brand:{'@type':'Brand',name:'verygood chocolate'},offers:choices.map(c=>({'@type':'Offer',name:c.name,price:money(c.price),priceCurrency:'AUD',url:siteUrl+c.url,...(item.id==='halloween-meringue'?{validThrough:HALLOWEEN_ORDER_DEADLINE,priceValidUntil:'2026-10-31'}:{})}))}:{})});
      const parent=RENEWAL_NAV.find(n=>item.id==='halloween-meringue'?n.href==='/cakes':(RENEWAL_CARDS[n.href.slice(1)]||[]).includes(item));
      page.structuredData.push({'@type':'BreadcrumbList',itemListElement:[{name:'Home',item:siteUrl},{name:parent.en,item:siteUrl+parent.href},{name,item:canonical}].map((v,i)=>({'@type':'ListItem',position:i+1,...v}))});
    }else{
      page.structuredData.push({'@type':list.length?'CollectionPage':'WebPage',name,url:canonical,...(list.length?{mainEntity:{'@type':'ItemList',itemListElement:list.map((c,i)=>({'@type':'ListItem',position:i+1,name:c.en,url:siteUrl+c.href}))}}:{})});
    }
    const services=path==='/custom-cakes'?'<p><a href="/cakes/custom-cake">Bespoke cake enquiries</a> · <a href="/classes">Class archive and enquiries</a></p>':path==='/business'?'<p><a href="/business/events">Corporate &amp; Events</a> · <a href="/business/cafe-supply">Café Supply / Wholesale · Coming Soon</a> · <a href="/business/consulting">Consulting</a></p>':'';
    page.fallbackHtml=`<main><nav>${nav}</nav><h1>${escape(name)}</h1><p>${escape(desc)}</p>${(product?siblings:list).map(cardFacts).join('')}${services}<p>${escape(pickup.hours)}</p><p>${escape(pickup.driver)}</p><p>Reservation requests are confirmed by our team after availability and payment checks. Choose an available pickup date when ordering.</p></main>`;
    pages[path]=page;
  }
  if(content){
    pages['/'].title=content.home.title;
    pages['/'].structuredData=[{'@type':'Organization','@id':siteUrl+'/#organization',name:'verygood chocolate',url:siteUrl,logo:siteUrl+'/favicon.png',description:content.site.organizationDescription,sameAs:content.site.socialProfiles,areaServed:{'@type':'City',name:'Sydney'}},{'@type':'WebSite','@id':siteUrl+'/#website',name:'verygood chocolate',url:siteUrl,inLanguage:'en-AU',publisher:{'@id':siteUrl+'/#organization'}},pages['/'].structuredData[0].mainEntity];
    pages['/'].fallbackHtml=pages['/'].fallbackHtml.replace('</main>',content.home.faq.map(f=>`<h2>${escape(f.question)}</h2><p>${escape(f.answer)}</p>`).join('')+'</main>');
  }
  return pages;
}
export function renderRenewalLlms(siteUrl, additionalEntries=[]) {
  const pickup=renewalPickupCopy('en');
  return ['# verygood chocolate Sydney','','Official Instagram: https://www.instagram.com/verygood_syd/',`Made-to-order cakes and treats with chocolatier-grade couverture chocolate. Pickup in Melrose Park, Sydney. ${pickup.hours} Requests are confirmed by our team after availability and payment checks.`,pickup.driver,...RENEWAL_NAV.map(n=>`- ${n.en}: ${siteUrl}${n.href}`),...Object.entries(RENEWAL_CARDS).flatMap(([category,list])=>['',`## ${RENEWAL_NAV.find(n=>n.href===`/${category}`).en}`,...list.flatMap(c=>[`- ${c.en}: ${description(c)} ${siteUrl}${c.href}`,...selections(c).map(o=>`  - ${o.name}: AUD ${money(o.price)}.`),...(!selections(c).length?['  Reservations await price approval.']:[]),...(c.id==='mochi'?[mochiTerms,'Minimum 24 hours preparation.',...MOCHI_PUBLIC_INFORMATION.en]:[]),...(c.offers.some(id=>RENEWAL_OFFERS[id].cream)?['  Optional Vanilla Fresh Cream +AUD 10.00.']:[])])]),'',`Class archive and enquiries: ${siteUrl}/classes`,CLASS_ARCHIVE_COPY.en.intro,CLASS_ARCHIVE_COPY.en.courses,...additionalEntries,''].join('\n');
}
