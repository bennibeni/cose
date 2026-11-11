import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import {driveStore} from './drive.mjs';
export const root = path.resolve(/* turbopackIgnore: true */ process.env.DATA_DIR || './data');
function useDrive(){
  if(process.env.STORAGE_BACKEND==='drive')return true;
  if(process.env.VERCEL)throw Object.assign(new Error('Su Vercel configura STORAGE_BACKEND=drive.'),{status:503});
  return false;
}
let queue = Promise.resolve();
export async function readArchive() {
  if(useDrive())return driveStore.readArchive();
  try { return JSON.parse(await readFile(path.join(root,'items.json'),'utf8')); }
  catch(e) { if(e.code === 'ENOENT') return {revision:0,items:[]}; throw e; }
}
export function updateArchive(revision, fn) {
  if(useDrive())return driveStore.updateArchive(revision,fn);
  const operation = queue.then(async()=>{
    const data = await readArchive();
    if(data.revision !== revision) throw Object.assign(new Error('Archivio aggiornato da un altro dispositivo. Ricarica e riprova.'),{status:409});
    data.items = await fn(data.items); data.revision++;
    await mkdir(root,{recursive:true});
    const temp = path.join(root,randomUUID()+'.tmp');
    await writeFile(temp,JSON.stringify(data,null,2));
    await rename(temp,path.join(root,'items.json'));
    return data;
  });
  queue = operation.catch(()=>{}); return operation;
}
export async function writePhoto(name,buffer){
  if(useDrive())return driveStore.writePhoto(name,buffer);
  await mkdir(path.join(root,'photos'),{recursive:true});
  await writeFile(path.join(root,'photos',name),buffer);
}
export async function readPhoto(name){
  if(useDrive())return driveStore.readPhoto(name);
  return readFile(path.join(root,'photos',name));
}
export function validateItem(input) {
  const text = (key,max)=>{ if(typeof input[key] !== 'string' || input[key].length>max) throw new Error('Campo non valido: '+key); return input[key].trim(); };
  const item = {phone:text('phone',80),date:text('date',10),address:text('address',1000),notes:text('notes',20000)};
  if(!item.phone || !item.address) throw new Error('Telefono e indirizzo sono obbligatori.');
  if(item.date && (!/^\d{4}-\d{2}-\d{2}$/.test(item.date) || new Date(item.date).toISOString().slice(0,10)!==item.date)) throw new Error('Data non valida.');
  if(!Array.isArray(input.websites) || input.websites.length>30) throw new Error('Link non validi.');
  item.websites = input.websites.map(link=>{ const url = new URL(link); if(!['https:','http:'].includes(url.protocol) || link.length>2000) throw new Error('Usa link http o https.'); return url.href; });
  if(!Array.isArray(input.photos) || input.photos.length>30 || input.photos.some(p=>!/^\/[a-z]+\/photos\/[a-f0-9-]+\.(jpg|png|webp)$/.test(p))) throw new Error('Foto non valide.');
  item.photos = input.photos; return item;
}
