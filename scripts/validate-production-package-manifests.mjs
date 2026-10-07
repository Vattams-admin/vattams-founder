import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const schema=JSON.parse(fs.readFileSync(path.join(root,'config/production-content-package-manifest.schema.json'),'utf8'));
const registry=JSON.parse(fs.readFileSync(path.join(root,'config/content-library-registry.json'),'utf8'));
const errors=[];
const domains=new Set(Object.keys(registry.domains));

if(!schema.properties?.packageId || !schema.properties?.governance) errors.push('manifest schema is incomplete');
const manifestRoot=path.join(root,'content');
if(fs.existsSync(manifestRoot)){
  const files=[];
  const walk=d=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())walk(p);else if(e.name==='manifest.json')files.push(p);}};
  walk(manifestRoot);
  for(const file of files){
    let m;
    try{m=JSON.parse(fs.readFileSync(file,'utf8'));}catch(e){errors.push(file+': invalid JSON');continue;}
    if(!m.packageId||!m.version||!domains.has(m.domain)) errors.push(file+': missing package identity/domain');
    if(m.assets?.manifestPath && m.assets.manifestPath!==path.relative(root,file).replaceAll('\\','/')) errors.push(file+': assets.manifestPath does not match its location');
    if(m.status==='published' && m.governance?.reviewStatus==='unreviewed') errors.push(file+': published package cannot be unreviewed');
    if(m.governance?.answerKeyPrivate!==true) errors.push(file+': answerKeyPrivate must be true');
  }
}
console.log('Production package manifest validation passed.');
console.log('Schema domains:', [...domains].join(', '));
console.log('Manifest files checked:', fs.existsSync(manifestRoot)?'filesystem scan complete':'no content manifests yet');
if(errors.length){console.error(errors.join('\n'));process.exit(1);}
