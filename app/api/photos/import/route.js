import {NextResponse} from 'next/server';
import sharp from 'sharp';
import {authorized,sameOrigin} from '../../../../lib/auth.mjs';
import {downloadRemoteImage,isRasterImage} from '../../../../lib/remote-image.mjs';
export const runtime='nodejs';
export const maxDuration=60;

export async function POST(req){
  if(!authorized(req))return new NextResponse(null,{status:401});
  if(!sameOrigin(req))return new NextResponse(null,{status:403});
  try{
    const {url}=await req.json();
    const original=await downloadRemoteImage(url);
    if(!isRasterImage(original))throw new Error('Unsupported raster format');
    const image=sharp(original,{limitInputPixels:40000000,animated:false});
    const metadata=await image.metadata();
    if(!['jpeg','png','webp','gif','heif','avif'].includes(metadata.format))throw new Error('Unsupported image');
    const bytes=await image.rotate().resize({width:2000,height:2000,fit:'inside',withoutEnlargement:true}).jpeg({quality:85}).toBuffer();
    if(bytes.length>3*1024*1024)throw new Error('Image too large');
    // This is a preview, not a persisted upload. Saving follows explicit cropping.
    return new Response(new Uint8Array(bytes),{headers:{'Content-Type':'image/jpeg','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
  }catch(e){return NextResponse.json({error:e.status?e.message:'Il link non restituisce un’immagine supportata. Usa “Copia indirizzo immagine”, oppure carica un file JPG, PNG o WebP.'},{status:e.status || 400});}
}
