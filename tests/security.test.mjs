import test from 'node:test';
import assert from 'node:assert/strict';
import {sameOrigin,cookieOptions} from '../lib/auth.mjs';
const req=(origin,host)=>({headers:new Headers({origin,host})});
test('production mutations require the exact configured origin; Vercel cookies are Secure',()=>{
 process.env.VERCEL='1';process.env.COOKIE_SECURE='false';delete process.env.APP_ORIGIN;
 assert.equal(sameOrigin(req('https://archive.example','archive.example')),false);
 process.env.APP_ORIGIN='https://archive.example';
 assert.equal(sameOrigin(req('https://archive.example','internal-host')),true);
 assert.equal(sameOrigin(req('https://archive.example.evil.test','archive.example')),false);
 assert.equal(sameOrigin(req('http://archive.example','archive.example')),false);
 assert.equal(sameOrigin(req('null','archive.example')),false);
 assert.equal(cookieOptions().secure,true);
 delete process.env.VERCEL;delete process.env.APP_ORIGIN;
});
test('Vercel refuses local persistent storage',async()=>{
 process.env.VERCEL='1';process.env.STORAGE_BACKEND='local';
 const {readArchive}=await import('../lib/storage.mjs');
 await assert.rejects(()=>readArchive(),{status:503});
 delete process.env.VERCEL;
});
