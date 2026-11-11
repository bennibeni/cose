import {authorized} from '../../../../lib/auth.mjs';
import {readPhoto} from '../../../../lib/storage.mjs';
export const runtime='nodejs';
export const maxDuration=60;
export async function GET(req,{params}){
 if(!authorized(req))return new Response(null,{status:401});
 const {name}=await params;if(!/^[a-f0-9-]+\.(jpg|png|webp)$/.test(name))return new Response(null,{status:404});
 try{
  const bytes=await readPhoto(name);
  const stream=new ReadableStream({start(controller){controller.enqueue(new Uint8Array(bytes));controller.close();}});
  return new Response(stream,{headers:{'Content-Type':name.endsWith('.jpg')?'image/jpeg':name.endsWith('.png')?'image/png':'image/webp','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
 }catch(e){return new Response(null,{status:e.status || (e.code==='ENOENT'?404:503)});}
}
