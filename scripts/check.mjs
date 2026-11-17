import {readdirSync,readFileSync,existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
for(const file of readdirSync('js').filter(x=>x.endsWith('.js'))){const r=spawnSync(process.execPath,['--check','js/'+file],{encoding:'utf8'});if(r.status)throw new Error(r.stderr);}
for(const page of ['index.html','admin.html','privacidade.html']){
 const html=readFileSync(page,'utf8');
 for(const [,url] of html.matchAll(/(?:src|href)="([^"]+)"/g)){
  if(/^(https?:|#)/.test(url))continue;
  if(!existsSync(url.split('#')[0]))throw new Error(page+': missing '+url);
 }
 const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);if(new Set(ids).size!==ids.length)throw new Error('Duplicate id in '+page);
}
console.log('JavaScript syntax, local links and HTML ids passed.');
