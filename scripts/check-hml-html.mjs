import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';

const htmlFiles=['apps/hml/index.html','apps/hml/writes.html','apps/hml/crm.html','apps/public-hml/index.html'];
const temp=mkdtempSync(join(tmpdir(),'diretoria-hml-check-'));
const targets=new Set();
let checked=0;

function checkJs(source,label){
  const target=join(temp,`script-${checked}.js`);
  writeFileSync(target,source);
  const result=spawnSync(process.execPath,['--check',target],{encoding:'utf8'});
  if(result.status!==0){process.stderr.write(result.stderr||result.stdout||`Syntax error in ${label}\n`);process.exit(result.status??1);}
  checked+=1;
}

try{
  for(const file of htmlFiles){
    const html=readFileSync(file,'utf8');
    for(const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)){
      const tag=match[0];
      const src=/\bsrc=["']([^"']+)["']/i.exec(tag)?.[1];
      if(src){
        if(src.startsWith('/')&&!src.startsWith('//'))targets.add(join(dirname(file),src.slice(1)));
        else if(!/^https?:\/\//i.test(src))targets.add(join(dirname(file),src));
      }else if(match[1].trim())checkJs(match[1],file);
    }
  }
  for(const file of targets){
    if(!existsSync(file))throw new Error(`HML_SCRIPT_NOT_FOUND:${file}`);
    checkJs(readFileSync(file,'utf8'),file);
  }
  if(!checked)throw new Error('NO_HML_SCRIPTS_CHECKED');
  console.log(`OK: ${checked} script(s) HML com sintaxe JavaScript válida.`);
}finally{rmSync(temp,{recursive:true,force:true});}
