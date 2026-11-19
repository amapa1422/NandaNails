import {createECDH,randomBytes} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
export function generatePushSecrets(){
 const pair=createECDH('prime256v1');pair.generateKeys();
 return {VAPID_PUBLIC_KEY:pair.getPublicKey().toString('base64url'),VAPID_PRIVATE_KEY:pair.getPrivateKey().toString('base64url'),PUSH_WORKER_SECRET:randomBytes(32).toString('hex')};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 if(!process.argv.includes('--write')){console.log('Use --write to create .local/push-secrets.env without printing secrets. Never commit this file.');}
 else {
  const secrets=generatePushSecrets();mkdirSync('.local',{recursive:true});
  writeFileSync('.local/push-secrets.env',Object.entries(secrets).map(([k,v])=>`${k}=${v}`).join('\n')+'\n',{flag:'wx',mode:0o600});
  console.log('Created .local/push-secrets.env. Add VAPID_SUBJECT locally before uploading via the approved procedure. Existing files are never overwritten.');
 }
}
