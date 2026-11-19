import {cpSync,mkdirSync,writeFileSync} from 'node:fs';
// Somente arquivos públicos. Nunca copia banco local, referência, testes ou secrets.
mkdirSync('dist',{recursive:true});
for(const file of ['index.html','admin.html','privacidade.html','admin.webmanifest','admin-sw.js','css','js','assets'])cpSync(file,'dist/'+file,{recursive:true});
writeFileSync('dist/.nojekyll','');
console.log('Frontend preparado em dist/. Nenhuma publicação realizada.');
