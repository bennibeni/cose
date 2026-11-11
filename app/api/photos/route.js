import {NextResponse} from 'next/server';
import {randomUUID} from 'node:crypto';
import {authorized,sameOrigin} from '../../../lib/auth.mjs';
import {writePhoto} from '../../../lib/storage.mjs';
export const runtime='nodejs';
export const maxDuration=60;
const MAX_PHOTO_BYTES=3*1024*1024;
export async function POST(req){
 if(!authorized(req))return new NextResponse(null,{status:401});
 if(!sameOrigin(req))return new NextResponse(null,{status:403});
 if(Number(req.headers.get('content-length'))>MAX_PHOTO_BYTES+65536)return NextResponse.json({error:'Foto troppo grande (massimo 3 MB).'}, {status:413});
 try{
  const form=await req.formData();const file=form.get('photo');
  if(!file || typeof file.arrayBuffer!=='function' || file.size>MAX_PHOTO_BYTES)throw new Error('Foto non valida.');
  const data=Buffer.from(await file.arrayBuffer());let ext;
  if(data.subarray(0,3).equals(Buffer.from([255,216,255])))ext='jpg';
  else if(data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))ext='png';
  else if(data.toString('ascii',0,4)==='RIFF' && data.toString('ascii',8,12)==='WEBP')ext='webp';
  else throw new Error('Formato non valido.');
  const name=randomUUID()+'.'+ext;await writePhoto(name,data);return NextResponse.json({url:'/api/photos/'+name});
 }catch(e){return NextResponse.json({error:e.status?e.message:'Impossibile caricare la foto. Usa JPG, PNG o WebP fino a 3 MB.'},{status:e.status || 400});}
}
