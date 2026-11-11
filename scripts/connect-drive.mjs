// Local one-time setup. No public OAuth callback and no Google credentials in React.
import http from 'node:http';
import {randomBytes,createHash,timingSafeEqual} from 'node:crypto';
import {writeFile,access,readFile} from 'node:fs/promises';
import {DRIVE_SCOPE} from '../lib/drive.mjs';
import {encrypt} from '../lib/encryption.mjs';

const destination=new URL('../.env.drive.local',import.meta.url);
const redirect='http://127.0.0.1:53682/oauth/callback';
let clientId=process.env.GOOGLE_CLIENT_ID;
let clientSecret=process.env.GOOGLE_CLIENT_SECRET;
if(!clientId || !clientSecret){
 try{
  const credentials=JSON.parse(await readFile(new URL('../.google-oauth-client.json',import.meta.url),'utf8')).web;
  if(!credentials || typeof credentials.client_id!=='string' || typeof credentials.client_secret!=='string' || !credentials.redirect_uris?.includes(redirect))throw new Error();
  clientId=credentials.client_id;clientSecret=credentials.client_secret;
 }catch{throw new Error('Il JSON OAuth deve essere di tipo Applicazione web e includere http://127.0.0.1:53682/oauth/callback. Nessun segreto è stato mostrato.');}
}
const state=randomBytes(32).toString('base64url');
const verifier=randomBytes(64).toString('base64url');
const key=process.env.ARCHIVE_ENCRYPTION_KEY || randomBytes(32).toString('base64');
if(!clientId || !clientSecret)throw new Error('Configura il JSON OAuth locale oppure le variabili GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET.');
try{await access(destination);throw new Error('.env.drive.local esiste già: conservarlo e spostarlo prima di creare un nuovo archivio.');}catch(e){if(e.code!=='ENOENT')throw e;}

async function checkedFetch(url,options){
 const res=await fetch(url,{...options,signal:AbortSignal.timeout(30000)});
 if(!res.ok)throw new Error('Configurazione Google non riuscita (HTTP '+res.status+'). Nessuna credenziale viene mostrata.');
 return res;
}
async function setup(code){
 const token=await(await checkedFetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:clientId,client_secret:clientSecret,code,code_verifier:verifier,redirect_uri:redirect,grant_type:'authorization_code'})})).json();
 if(!token.refresh_token || token.scope?.split(' ').some(scope=>scope!==DRIVE_SCOPE))throw new Error('Autorizzazione non valida: usa un client dedicato con il solo scope drive.file.');
 const auth={Authorization:'Bearer '+token.access_token};
 const folder=await(await checkedFetch('https://www.googleapis.com/drive/v3/files?fields=id',{method:'POST',headers:{...auth,'Content-Type':'application/json'},body:JSON.stringify({name:'Cose — archivio privato',mimeType:'application/vnd.google-apps.folder'})})).json();
 const privacy=await(await checkedFetch(`https://www.googleapis.com/drive/v3/files/${folder.id}?fields=shared,ownedByMe`,{headers:auth})).json();
 if(privacy.shared!==false || privacy.ownedByMe!==true)throw new Error('La cartella non è privata o non appartiene al tuo account. Verifica le regole di condivisione Google.');
 const boundary='cose-'+randomBytes(16).toString('hex');
 const content=encrypt(Buffer.from(JSON.stringify({revision:0,items:[]})),key,'cose:archive');
 const meta={name:'items.encrypted.json',parents:[folder.id],mimeType:'application/json'};
 const body=Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(meta)}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n`),content,Buffer.from(`\r\n--${boundary}--\r\n`)]);
 const file=await(await checkedFetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',{method:'POST',headers:{...auth,'Content-Type':`multipart/related; boundary=${boundary}`},body})).json();
 // Verify real Drive preconditions before recommending multi-instance deployment.
 const resource=`https://www.googleapis.com/drive/v2/files/${file.id}?fields=etag`;
 const old=await(await checkedFetch(resource,{headers:auth})).json();
 if(!old.etag)throw new Error('Drive non ha restituito il controllo di versione.');
 const update=`https://www.googleapis.com/upload/drive/v2/files/${file.id}?uploadType=media`;
 const changed=encrypt(Buffer.from(JSON.stringify({revision:0,items:[]})),key,'cose:archive');
 const options={method:'PUT',headers:{...auth,'Content-Type':'application/json','If-Match':old.etag},body:changed};
 await checkedFetch(update,options);
 const stale=await fetch(update,{...options,signal:AbortSignal.timeout(30000)});
 if(stale.status!==412)throw new Error('Il controllo sulle scritture simultanee non è stato confermato da Drive. Non pubblicare questa configurazione.');
 const values={STORAGE_BACKEND:'drive',GOOGLE_CLIENT_ID:clientId,GOOGLE_CLIENT_SECRET:clientSecret,GOOGLE_REFRESH_TOKEN:token.refresh_token,GOOGLE_DRIVE_FOLDER_ID:folder.id,GOOGLE_DRIVE_ARCHIVE_ID:file.id,ARCHIVE_ENCRYPTION_KEY:key};
 const output=Object.entries(values).map(([name,value])=>name+'='+JSON.stringify(value)).join('\n')+'\n';
 await writeFile(destination,output,{flag:'wx',mode:0o600});
}

let processing=false;
const server=http.createServer(async(req,res)=>{
 res.setHeader('Cache-Control','no-store');
 res.setHeader('Content-Security-Policy',"default-src 'none'; frame-ancestors 'none'");
 res.setHeader('Referrer-Policy','no-referrer');
 const url=new URL(req.url,redirect);
 const received=url.searchParams.get('state') || '';
 if(req.method!=='GET' || req.headers.host!=='127.0.0.1:53682' || url.pathname!=='/oauth/callback' || !/^[A-Za-z0-9_-]+$/.test(received) || received.length!==state.length || !timingSafeEqual(Buffer.from(received),Buffer.from(state))){res.writeHead(400);res.end('Richiesta non valida.');return;}
 if(processing){res.writeHead(409);res.end('Configurazione in corso.');return;}
 processing=true;
 try{
  if(url.searchParams.has('error') || !url.searchParams.get('code'))throw new Error('Autorizzazione Google annullata.');
  await setup(url.searchParams.get('code'));
  res.end('Drive configurato. Puoi chiudere questa scheda e tornare a Codex.');
  console.log('Configurazione completata. Segreti salvati solo in .env.drive.local (ignorato da Git). Conservare anche una copia sicura della chiave di cifratura.');
 }catch(e){res.writeHead(500);res.end('Configurazione non completata. Consulta il terminale locale.');console.error(e.message);process.exitCode=1;}
 finally{clearTimeout(timeout);server.close();}
});
server.listen(53682,'127.0.0.1',()=>{
 const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');
 url.search=new URLSearchParams({client_id:clientId,redirect_uri:redirect,response_type:'code',scope:DRIVE_SCOPE,access_type:'offline',prompt:'consent',state,code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256'}).toString();
 console.log('Apri questo link nel browser ed esegui personalmente l’autorizzazione Google:\n'+url.href);
});
const timeout=setTimeout(()=>{console.error('Tempo scaduto. Rilancia lo script per riprovare.');server.close();process.exitCode=1;},10*60*1000);
server.on('error',()=>{clearTimeout(timeout);console.error('Impossibile aprire la porta locale 53682.');process.exitCode=1;});
