import {lookup as dnsLookup} from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';
import {isIP} from 'node:net';
import ipaddr from 'ipaddr.js';

const MAX_BYTES=15*1024*1024;
const failure=message=>Object.assign(new Error(message),{status:400});
export function isRasterImage(bytes){
  if(bytes.subarray(0,3).equals(Buffer.from([255,216,255])))return true;
  if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return true;
  if(bytes.toString('ascii',0,4)==='RIFF' && bytes.toString('ascii',8,12)==='WEBP')return true;
  if(['GIF87a','GIF89a'].includes(bytes.toString('ascii',0,6)))return true;
  return bytes.toString('ascii',4,8)==='ftyp' && ['avif','avis','heic','heix','hevc','hevx','mif1','msf1'].includes(bytes.toString('ascii',8,12));
}
export function isPublicAddress(address){
  try{return ipaddr.process(address).range()==='unicast';}catch{return false;}
}
export function imageUrl(input){
  let url;try{url=new URL(input);}catch{throw failure('Inserisci il link completo dell’immagine (http o https).');}
  if(!['http:','https:'].includes(url.protocol) || url.username || url.password || (url.port && url.port!==(url.protocol==='https:'?'443':'80')))throw failure('Usa un link http o https senza credenziali o porte personalizzate.');
  const host=url.hostname.replace(/^\[|\]$/g,'');
  if(!host || host==='localhost' || host.endsWith('.localhost') || host.endsWith('.local') || (isIP(host) && !isPublicAddress(host)))throw failure('Il link deve indicare un’immagine su un sito pubblico.');
  url.hash='';return url;
}
async function publicAddress(url,lookup){
  const host=url.hostname.replace(/^\[|\]$/g,'');
  const records=isIP(host)?[{address:host,family:isIP(host)}]:await lookup(host,{all:true,verbatim:true});
  if(!records.length || records.some(record=>!isPublicAddress(record.address)))throw failure('L’indirizzo del sito non è consentito.');
  return records[0];
}
function requestImage(url,address,signal){
  return new Promise((resolve,reject)=>{
    // DNS is checked first and pinned for the actual connection, including redirects.
    const request=(url.protocol==='https:'?https:http).get(url,{
      agent:false,signal,
      headers:{Accept:'image/jpeg,image/png,image/webp,image/gif,image/avif','User-Agent':'Cose-Image-Import/1.0'},
      lookup(host,options,callback){
        if(options.all)callback(null,[address]);else callback(null,address.address,address.family);
      }
    },response=>{
      const status=response.statusCode;
      if([301,302,303,307,308].includes(status)){
        response.resume();resolve({status,location:response.headers.location});return;
      }
      if(status!==200){response.resume();reject(failure('Il sito non permette di scaricare questa immagine. Prova a salvarla sul dispositivo.'));return;}
      if(Number(response.headers['content-length'])>MAX_BYTES){response.destroy();reject(failure('L’immagine supera 15 MB.'));return;}
      const chunks=[];let size=0;
      response.on('data',chunk=>{
        size+=chunk.length;
        if(size>MAX_BYTES){response.destroy();reject(failure('L’immagine supera 15 MB.'));return;}
        chunks.push(chunk);
      });
      response.on('end',()=>resolve({status,bytes:Buffer.concat(chunks)}));
      response.on('error',()=>reject(failure('Download interrotto. Riprova con un altro link.')));
    });
    request.on('error',()=>reject(failure('Impossibile raggiungere l’immagine. Controlla il link o prova un altro sito.')));
  });
}
export async function downloadRemoteImage(input,{lookup=dnsLookup,transport=requestImage}={}){
  if(typeof input!=='string' || input.length>4000)throw failure('Link dell’immagine non valido.');
  const signal=AbortSignal.timeout(20000);
  let url=imageUrl(input);
  for(let redirects=0;redirects<=3;redirects++){
    let address;
    try{
      address=await Promise.race([
        publicAddress(url,lookup),
        new Promise((resolve,reject)=>{
          if(signal.aborted)reject(failure('Download scaduto.'));
          else signal.addEventListener('abort',()=>reject(failure('Download scaduto.')),{once:true});
        })
      ]);
    }catch(e){throw e.status?e:failure('Non è stato possibile trovare il sito dell’immagine.');}
    const response=await transport(url,address,signal);
    if(response.status===200){
      if(!response.bytes?.length || response.bytes.length>MAX_BYTES)throw failure('Immagine vuota o troppo grande.');
      return response.bytes;
    }
    if(!response.location || redirects===3)throw failure('Il link effettua troppi reindirizzamenti. Usa l’indirizzo diretto dell’immagine.');
    url=imageUrl(new URL(response.location,url).href);
  }
}
