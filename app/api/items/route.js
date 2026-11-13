import {NextResponse} from 'next/server';
import {randomUUID} from 'node:crypto';
import {authorized,sameOrigin} from '../../../lib/auth.mjs';
import {readArchive,updateArchive,validateItem} from '../../../lib/storage.mjs';
import {assertUniquePhone} from '../../../lib/phone.mjs';
export const runtime='nodejs';
export const maxDuration=60;
export async function GET(req){if(!authorized(req))return new NextResponse(null,{status:401});try{return NextResponse.json(await readArchive(),{headers:{'Cache-Control':'no-store'}});}catch(e){return NextResponse.json({error:e.status?e.message:'Impossibile leggere l’archivio.'},{status:e.status || 503});}}
export async function POST(req){if(!authorized(req))return new NextResponse(null,{status:401});if(!sameOrigin(req))return new NextResponse(null,{status:403});try{const body=await req.json();const data=await updateArchive(body.revision,items=>{
 if(body.action==='create'){const value=validateItem(body.item);assertUniquePhone(items,value.phone);return [...items,{...value,id:randomUUID(),createdAt:new Date().toISOString()}];}
 if(body.action==='update'){if(!items.some(x=>x.id===body.id))throw new Error('Elemento non trovato.');const value=validateItem(body.item);assertUniquePhone(items,value.phone,body.id);return items.map(x=>x.id===body.id?{...x,...value}:x);}
 if(body.action==='delete')return items.filter(x=>x.id!==body.id);
 if(body.action==='reorder'){if(!Array.isArray(body.ids) || body.ids.length!==items.length || new Set(body.ids).size!==items.length || body.ids.some(id=>!items.some(x=>x.id===id)))throw new Error('Ordine non valido.');return body.ids.map(id=>items.find(x=>x.id===id));}
 throw new Error('Operazione non valida.');
 });return NextResponse.json(data);}catch(e){return NextResponse.json({error:e.message},{status:e.status || 400});}}
