import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
function keyFrom(value) {
  const key=Buffer.from(value || '', 'base64');
  if(key.length!==32) throw Object.assign(new Error('Chiave di cifratura non configurata.'),{status:503});
  return key;
}
export function encrypt(data,secret,context) {
  const iv=randomBytes(12);
  const cipher=createCipheriv('aes-256-gcm',keyFrom(secret),iv);
  cipher.setAAD(Buffer.from(context));
  const ciphertext=Buffer.concat([cipher.update(data),cipher.final()]);
  return Buffer.from(JSON.stringify({v:1,iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),ciphertext:ciphertext.toString('base64')}));
}
export function decrypt(data,secret,context) {
  try {
    const envelope=JSON.parse(data.toString('utf8'));
    if(envelope.v!==1) throw new Error();
    const decipher=createDecipheriv('aes-256-gcm',keyFrom(secret),Buffer.from(envelope.iv,'base64'));
    decipher.setAAD(Buffer.from(context));
    decipher.setAuthTag(Buffer.from(envelope.tag,'base64'));
    return Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext,'base64')),decipher.final()]);
  }catch{throw Object.assign(new Error('Impossibile decifrare l’archivio. Verifica la chiave di cifratura.'),{status:503});}
}
