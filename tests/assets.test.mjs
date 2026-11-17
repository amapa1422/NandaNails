import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
test('all original logo and photo bytes are preserved',()=>{
 const original=readFileSync('reference/index.original.html','utf8');
 const embedded=[...original.matchAll(/data:image\/[a-zA-Z+]+;base64,([A-Za-z0-9+/=]+)/g)].map(m=>createHash('sha256').update(Buffer.from(m[1],'base64')).digest('hex'));
 const manifest=JSON.parse(readFileSync('reference/assets.sha256.json','utf8'));
 assert.equal(Object.keys(manifest).length,12);
 assert.deepEqual(new Set(embedded),new Set(Object.values(manifest)));
 for(const [path,hash] of Object.entries(manifest))assert.equal(createHash('sha256').update(readFileSync(path)).digest('hex'),hash);
});
