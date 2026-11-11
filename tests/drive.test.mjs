import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {createDriveStore} from '../lib/drive.mjs';
import {encrypt,decrypt} from '../lib/encryption.mjs';
const key=randomBytes(32).toString('base64');
const env={GOOGLE_CLIENT_ID:'client',GOOGLE_CLIENT_SECRET:'secret-never-in-errors',GOOGLE_REFRESH_TOKEN:'refresh-never-in-errors',GOOGLE_DRIVE_FOLDER_ID:'folder123',GOOGLE_DRIVE_ARCHIVE_ID:'archive123',ARCHIVE_ENCRYPTION_KEY:key};
const json=data=>new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json'}});
function fakeDrive(){
 let etag=1;
 let content=encrypt(Buffer.from(JSON.stringify({revision:0,items:[]})),key,'cose:archive');
 const writes=[];
 const calls=[];
 let photo;
 async function fetcher(url,options={}){
  calls.push({url,options});
  if(url==='https://oauth2.googleapis.com/token')return json({access_token:'access-token',expires_in:3600});
  assert.equal(options.headers.Authorization,'Bearer access-token');
  if(url.includes('/upload/drive/v2/')){
   if(options.headers['If-Match']!==String(etag))return new Response(null,{status:412});
   content=Buffer.from(options.body);writes.push(content);etag++;return json({id:'archive123'});
  }
  if(url.includes('/upload/drive/v3/')){
   const body=Buffer.from(options.body).toString('utf8');
   const match=body.match(/\r\nContent-Type: application\/octet-stream\r\n\r\n([^\r]+)/);
   photo=Buffer.from(match[1]);return json({id:'photo123'});
  }
  if(url.includes('/drive/v3/files?'))return json({files:[{id:'photo123',shared:false,mimeType:'application/octet-stream'}]});
  if(url.includes('/drive/v3/files/photo123'))return new Response(photo);
  if(url.includes('alt=media'))return new Response(content);
  return json({id:'archive123',etag:String(etag),shared:false,mimeType:'application/json',parents:[{id:'folder123'}],labels:{trashed:false}});
 }
 return {fetcher,calls,writes};
}
test('AES-GCM hides content and rejects tampering, wrong key and swapped photos',()=>{
 const plain=Buffer.from('private contact and address');
 const encrypted=encrypt(plain,key,'cose:photo:one');
 assert.equal(encrypted.includes(plain),false);
 assert.deepEqual(decrypt(encrypted,key,'cose:photo:one'),plain);
 assert.throws(()=>decrypt(encrypted,key,'cose:photo:two'));
 assert.throws(()=>decrypt(encrypted,randomBytes(32).toString('base64'),'cose:photo:one'));
 const altered=JSON.parse(encrypted);altered.tag=Buffer.alloc(16).toString('base64');
 assert.throws(()=>decrypt(Buffer.from(JSON.stringify(altered)),key,'cose:photo:one'));
});
test('independent serverless instances cannot overwrite the same revision',async()=>{
 const drive=fakeDrive();const one=createDriveStore({env,fetcher:drive.fetcher}),two=createDriveStore({env,fetcher:drive.fetcher});
 let arrived=0,release;const ready=new Promise(r=>{release=r;});
 const change=async items=>{arrived++;if(arrived===2)release();await ready;return [...items,{id:'one',notes:'private-note'}];};
 const results=await Promise.allSettled([one.updateArchive(0,change),two.updateArchive(0,change)]);
 assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
 assert.equal(results.find(x=>x.status==='rejected').reason.status,409);
 assert.equal(drive.writes.length,1);assert.equal(drive.writes[0].includes('private-note'),false);
 assert.equal((await two.readArchive()).items[0].notes,'private-note');
 await assert.rejects(()=>one.updateArchive(0,()=>[]),{status:409});
});
test('photos are encrypted, retrieved through a folder-scoped query, and never made public',async()=>{
 const drive=fakeDrive();const store=createDriveStore({env,fetcher:drive.fetcher});
 const name='aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.jpg',photo=Buffer.from('photo bytes');
 await store.writePhoto(name,photo);
 assert.deepEqual(await store.readPhoto(name),photo);
 assert.ok(drive.calls.some(c=>c.url.includes('folder123') && c.url.includes('appProperties')));
 assert.ok(drive.calls.every(c=>!c.url.includes('/permissions')));
 await assert.rejects(()=>store.readPhoto("../arbitrary-file"),{status:404});
});
test('configuration and upstream failures fail closed without leaking Google errors',async()=>{
 const missing=createDriveStore({env:{},fetcher:()=>{throw new Error('should not run');}});
 await assert.rejects(()=>missing.readArchive(),{status:503});
 const denied=createDriveStore({env,fetcher:async()=>new Response('refresh-never-in-errors',{status:401})});
 await assert.rejects(()=>denied.readArchive(),e=>e.status===503 && !e.message.includes('refresh-never-in-errors'));
});
test('a shared archive is rejected before reading or writing its content',async()=>{
 const drive=fakeDrive();
 const fetcher=async(url,options)=>{
  if(url.includes('fields=id,etag'))return json({id:'archive123',etag:'1',shared:true,mimeType:'application/json',parents:[{id:'folder123'}]});
  return drive.fetcher(url,options);
 };
 const store=createDriveStore({env,fetcher});
 await assert.rejects(()=>store.readArchive(),{status:503});
 assert.equal(drive.calls.some(c=>c.url.includes('alt=media')),false);
});
