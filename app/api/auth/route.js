import {NextResponse} from 'next/server';
import {authorized,login,token,sameOrigin,cookieOptions} from '../../../lib/auth.mjs';
export const runtime='nodejs';
export async function GET(req){return NextResponse.json({authenticated:authorized(req)},{headers:{'Cache-Control':'no-store'}});}
export async function POST(req){if(!sameOrigin(req))return new NextResponse(null,{status:403});try{const {password}=await req.json();if(!login(password))return NextResponse.json({error:'Password errata o troppi tentativi. Riprova tra un minuto.'},{status:401});const res=NextResponse.json({ok:true});res.cookies.set('archive-session',token(),cookieOptions());return res;}catch(e){return NextResponse.json({error:e.message},{status:503});}}
export async function DELETE(req){if(!sameOrigin(req))return new NextResponse(null,{status:403});const res=NextResponse.json({ok:true});res.cookies.set('archive-session','',{...cookieOptions(),maxAge:0});return res;}
