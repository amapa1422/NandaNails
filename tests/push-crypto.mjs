// Deno/npm compatibility and real Web Push encryption, strictly WITHOUT network.
import assert from 'node:assert/strict';
import {createECDH,randomBytes} from 'node:crypto';
import webpush from 'npm:web-push@3.6.7';
import ece from 'npm:http_ece@1.2.0';
import {dispatch} from '../supabase/functions/_shared/push-runtime.ts';
assert.equal(typeof dispatch,'function');
const vapid=webpush.generateVAPIDKeys(),receiver=createECDH('prime256v1');receiver.generateKeys();
const auth=randomBytes(16),payload='Generic local notification test';
const subscription={endpoint:'https://web.push.apple.com/local-test-never-sent',keys:{p256dh:receiver.getPublicKey().toString('base64url'),auth:auth.toString('base64url')}};
webpush.setVapidDetails('mailto:test@example.invalid',vapid.publicKey,vapid.privateKey);
const details=webpush.generateRequestDetails(subscription,payload,{TTL:3600,urgency:'normal',timeout:10000});
assert.equal(details.headers['Content-Encoding'],'aes128gcm');assert.match(details.headers.Authorization,/^vapid /);
assert.notEqual(details.body.toString(),payload);
const plaintext=ece.decrypt(details.body,{version:'aes128gcm',privateKey:receiver,authSecret:auth});
assert.equal(plaintext.toString(),payload);
console.log('PASS actual Deno imports, ephemeral VAPID signature, AES128GCM encryption and receiver decryption; no network permission or provider send.');
