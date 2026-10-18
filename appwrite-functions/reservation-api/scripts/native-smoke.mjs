import assert from 'node:assert/strict'
import sharp from 'sharp'
import {normalizeCustomCakePhoto} from '../src/custom-cake-photo-codec.js'
if(process.argv.includes('--linux-node22') && (process.platform!=='linux'||process.arch!=='x64'||!process.versions.node.startsWith('22.'))) throw Error('NATIVE_PLATFORM_MISMATCH')
assert.equal(sharp.versions.sharp,'0.35.5','PATCHED_SHARP_REQUIRED')
const source=()=>sharp({create:{width:32,height:16,channels:3,background:'#aa5588'}})
const formats=[]
for(const [format,mime] of [['jpeg','image/jpeg'],['png','image/png'],['webp','image/webp']]) {
 const input=await source()[format]().withMetadata({orientation:6}).toBuffer()
 const output=await normalizeCustomCakePhoto(input,mime),meta=await sharp(output.bytes).metadata()
 assert.equal(meta.format,'webp');assert.equal(meta.width,16);assert.equal(meta.height,32)
 for(const key of ['exif','icc','iptc','xmp','orientation']) assert.equal(meta[key],undefined)
 assert.deepEqual(await normalizeCustomCakePhoto(input,mime),output)
 formats.push(format)
}
await assert.rejects(normalizeCustomCakePhoto(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),'image/png'),{code:'PHOTO_INVALID_IMAGE'})
const png=await source().png().toBuffer()
await assert.rejects(normalizeCustomCakePhoto(png.subarray(0,-12),'image/png'),{code:'PHOTO_INVALID_IMAGE'})
console.log(JSON.stringify({node:process.versions.node,platform:process.platform,arch:process.arch,sharp:sharp.versions.sharp,vips:sharp.versions.vips,rsvg:sharp.versions.rsvg||null,formats,rejectedSvg:true,rejectedTruncated:true}))
