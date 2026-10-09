import {mkdirSync,readFileSync,writeFileSync,copyFileSync} from 'node:fs';
mkdirSync('dist/server',{recursive:true});
const css=readFileSync('theme.css','utf8');
const assets=Object.fromEntries(['guild-logo.png','mountain.jpg'].map(name=>['/assets/'+name,{type:name.endsWith('.png')?'image/png':'image/jpeg',data:readFileSync('assets/'+name).toString('base64')}]));
writeFileSync('dist/server/index.js',readFileSync('worker.js','utf8').replace('/* ORIGINAL_CSS */',css).replace('/* ASSET_MAP */ {}',JSON.stringify(assets)));
console.log('Worker built with the guild reference theme and bundled artwork.');
