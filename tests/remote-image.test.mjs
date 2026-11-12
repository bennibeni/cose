import test from 'node:test';
import assert from 'node:assert/strict';
import {imageUrl,isPublicAddress,isRasterImage,downloadRemoteImage} from '../lib/remote-image.mjs';

test('non-raster content is rejected before passing bytes to an image decoder',()=>{
  assert.equal(isRasterImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><image href="http://127.0.0.1/"/></svg>')),false);
  assert.equal(isRasterImage(Buffer.from('<html>Image page</html>')),false);
  assert.equal(isRasterImage(Buffer.from([255,216,255,224])),true);
  assert.equal(isRasterImage(Buffer.from('GIF89a')),true);
});

test('remote import blocks private, loopback, reserved and mapped addresses',()=>{
  for(const ip of ['127.0.0.1','10.1.2.3','172.16.0.1','192.168.1.2','169.254.169.254','100.64.0.1','0.0.0.0','224.0.0.1','::1','fe80::1','fc00::1','::ffff:127.0.0.1','2001:db8::1'])assert.equal(isPublicAddress(ip),false,ip);
  for(const ip of ['1.1.1.1','8.8.8.8','2606:4700:4700::1111'])assert.equal(isPublicAddress(ip),true,ip);
  for(const url of ['file:///etc/passwd','ftp://example.com/x','https://user:pass@example.com/x','http://localhost/x','https://example.local/x','http://2130706433/x','http://[::ffff:127.0.0.1]/x','http://example.com:8080/x'])assert.throws(()=>imageUrl(url));
});
test('mixed public/private DNS answers fail before opening a connection',async()=>{
  let requested=false;
  await assert.rejects(()=>downloadRemoteImage('https://example.com/image.jpg',{
    lookup:async()=>[{address:'1.1.1.1',family:4},{address:'10.0.0.1',family:4}],
    transport:async()=>{requested=true;}
  }),{status:400});
  assert.equal(requested,false);
});
test('redirect targets are checked again and connection receives the vetted IP',async()=>{
  let requests=0;
  await assert.rejects(()=>downloadRemoteImage('https://example.com/image.jpg',{
    lookup:async()=>[{address:'1.1.1.1',family:4}],
    transport:async(url,address)=>{requests++;assert.equal(address.address,'1.1.1.1');return {status:302,location:'http://169.254.169.254/metadata'};}
  }),{status:400});
  assert.equal(requests,1);
});
test('DNS rebinding between redirects cannot introduce a private destination',async()=>{
  let lookups=0,requests=0;
  await assert.rejects(()=>downloadRemoteImage('https://example.com/image.jpg',{
    lookup:async()=>[{address:++lookups===1?'1.1.1.1':'127.0.0.1',family:4}],
    transport:async()=>{requests++;return {status:302,location:'/other.jpg'};}
  }),{status:400});
  assert.equal(requests,1);
});
test('public images are returned with bounded size and redirect count',async()=>{
  const lookup=async()=>[{address:'1.1.1.1',family:4}];
  const bytes=Buffer.from('sample image');
  assert.deepEqual(await downloadRemoteImage('https://example.com/image.jpg',{lookup,transport:async()=>({status:200,bytes})}),bytes);
  await assert.rejects(()=>downloadRemoteImage('https://example.com/image.jpg',{lookup,transport:async()=>({status:200,bytes:Buffer.alloc(15*1024*1024+1)})}),{status:400});
  let requests=0;
  await assert.rejects(()=>downloadRemoteImage('https://example.com/image.jpg',{lookup,transport:async()=>{requests++;return {status:302,location:'/again'};}}),{status:400});
  assert.equal(requests,4);
});
