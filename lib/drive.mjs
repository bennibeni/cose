import {randomUUID} from 'node:crypto';
import {encrypt,decrypt} from './encryption.mjs';
export const DRIVE_SCOPE='https://www.googleapis.com/auth/drive.file';
const conflict=()=>Object.assign(new Error('Archivio aggiornato da un altro dispositivo. Ricarica e riprova.'),{status:409});
const unavailable=()=>Object.assign(new Error('Google Drive non disponibile. Verifica la configurazione o riprova più tardi.'),{status:503});
const validId=value=>typeof value==='string' && /^[A-Za-z0-9_-]{5,200}$/.test(value);
export function createDriveStore({env=process.env,fetcher=fetch}={}) {
  let cachedToken,tokenPromise;
  function config() {
    if(!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_REFRESH_TOKEN || !validId(env.GOOGLE_DRIVE_FOLDER_ID) || !validId(env.GOOGLE_DRIVE_ARCHIVE_ID) || Buffer.from(env.ARCHIVE_ENCRYPTION_KEY || '', 'base64').length!==32) throw unavailable();
  }
  async function accessToken() {
    config();
    if(cachedToken?.expires>Date.now()+60000)return cachedToken.value;
    if(!tokenPromise)tokenPromise=(async()=>{
      const res=await fetcher('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},cache:'no-store',signal:AbortSignal.timeout(20000),body:new URLSearchParams({grant_type:'refresh_token',client_id:env.GOOGLE_CLIENT_ID,client_secret:env.GOOGLE_CLIENT_SECRET,refresh_token:env.GOOGLE_REFRESH_TOKEN})});
      if(!res.ok)throw unavailable();
      const body=await res.json();
      if(typeof body.access_token!=='string')throw unavailable();
      cachedToken={value:body.access_token,expires:Date.now()+Number(body.expires_in || 3600)*1000};return cachedToken.value;
    })().finally(()=>{tokenPromise=undefined;});
    return tokenPromise;
  }
  async function request(url,options={}) {
    try{
      const res=await fetcher(url,{...options,headers:{...options.headers,Authorization:'Bearer '+await accessToken()},cache:'no-store',signal:AbortSignal.timeout(25000)});
      if(res.status===412)throw conflict();
      if(res.status===404)throw Object.assign(new Error('File dell’archivio non trovato.'),{status:404});
      if(!res.ok){if(res.status===401)cachedToken=undefined;throw unavailable();}return res;
    }catch(e){if(e.status)throw e;throw unavailable();}
  }
  async function metadata() {
    const res=await request(`https://www.googleapis.com/drive/v2/files/${env.GOOGLE_DRIVE_ARCHIVE_ID}?fields=id,etag,parents(id),labels(trashed),mimeType,shared`);
    const meta=await res.json();
    if(!meta.etag || meta.shared!==false || meta.labels?.trashed || meta.mimeType!=='application/json' || !meta.parents?.some(p=>p.id===env.GOOGLE_DRIVE_FOLDER_ID))throw unavailable();
    return meta;
  }
  async function snapshot() {
    config();
    // Bracket the content read so its content corresponds to the resource ETag.
    for(let attempt=0;attempt<3;attempt++){
      const before=await metadata();
      const res=await request(`https://www.googleapis.com/drive/v2/files/${env.GOOGLE_DRIVE_ARCHIVE_ID}?alt=media`);
      const buffer=Buffer.from(await res.arrayBuffer());
      const after=await metadata();
      if(before.etag!==after.etag)continue;
      const archive=JSON.parse(decrypt(buffer,env.ARCHIVE_ENCRYPTION_KEY,'cose:archive').toString('utf8'));
      if(!Number.isSafeInteger(archive.revision) || !Array.isArray(archive.items))throw unavailable();
      return {archive,etag:after.etag};
    }throw conflict();
  }
  async function readArchive(){return(await snapshot()).archive;}
  async function updateArchive(revision,fn){
    const {archive,etag}=await snapshot();
    if(archive.revision!==revision)throw conflict();
    archive.items=await fn(archive.items);archive.revision++;
    const body=encrypt(Buffer.from(JSON.stringify(archive)),env.ARCHIVE_ENCRYPTION_KEY,'cose:archive');
    if(body.length>4*1024*1024)throw Object.assign(new Error('Archivio troppo grande. Esporta i dati prima di aggiungere altri elementi.'),{status:413});
    await request(`https://www.googleapis.com/upload/drive/v2/files/${env.GOOGLE_DRIVE_ARCHIVE_ID}?uploadType=media`,{method:'PUT',headers:{'Content-Type':'application/json','If-Match':etag},body});return archive;
  }
  async function writePhoto(name,buffer){
    config();
    await metadata();
    const boundary='cose-'+randomUUID();
    const photoMetadata={name:name+'.encrypted',parents:[env.GOOGLE_DRIVE_FOLDER_ID],mimeType:'application/octet-stream',appProperties:{app:'cose',kind:'photo',name}};
    const payload=encrypt(buffer,env.ARCHIVE_ENCRYPTION_KEY,'cose:photo:'+name);
    const body=Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(photoMetadata)}\r\n--${boundary}\r\nContent-Type: application/octet-stream\r\n\r\n`),payload,Buffer.from(`\r\n--${boundary}--\r\n`)]);
    await request('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',{method:'POST',headers:{'Content-Type':`multipart/related; boundary=${boundary}`},body});
  }
  async function readPhoto(name){
    config();
    if(!/^[a-f0-9-]+\.(jpg|png|webp)$/.test(name))throw Object.assign(new Error('Foto non trovata.'),{status:404});
    const q=`'${env.GOOGLE_DRIVE_FOLDER_ID}' in parents and trashed = false and appProperties has { key='app' and value='cose' } and appProperties has { key='kind' and value='photo' } and appProperties has { key='name' and value='${name}' }`;
    const params=new URLSearchParams({q,spaces:'drive',fields:'files(id,shared,mimeType)',pageSize:'2'});
    const result=await(await request('https://www.googleapis.com/drive/v3/files?'+params)).json();
    if(result.files?.length!==1 || result.files[0].shared!==false || result.files[0].mimeType!=='application/octet-stream')throw Object.assign(new Error('Foto non trovata o non privata.'),{status:404});
    const res=await request(`https://www.googleapis.com/drive/v3/files/${result.files[0].id}?alt=media`);
    return decrypt(Buffer.from(await res.arrayBuffer()),env.ARCHIVE_ENCRYPTION_KEY,'cose:photo:'+name);
  }
  return {readArchive,updateArchive,writePhoto,readPhoto};
}
export const driveStore=createDriveStore();
