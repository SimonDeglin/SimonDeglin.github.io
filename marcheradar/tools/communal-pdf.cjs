/* Lecture textuelle puis OCR borné des premières pages si le PDF est scanné. */
'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
function extract(bytes){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mr-council-pdf-')),file=path.join(dir,'source.pdf');
 try{
  fs.writeFileSync(file,bytes);const text=cp.execFileSync('pdftotext',['-layout',file,'-'],{encoding:'utf8',timeout:16000,maxBuffer:6000000});
  if(text.trim().length>=30)return {text,method:'pdf_text',partial:false};
  if(process.env.COMMUNES_OCR==='0')return {text,method:'pdf_text',partial:false};
  const langs=cp.spawnSync('tesseract',['--list-langs'],{encoding:'utf8',timeout:4000});if(langs.error||langs.status!==0)return {text,method:'pdf_text',partial:false};
  const language=/\bfra\b/.test(langs.stdout)?'fra+eng':'eng',limit=Math.min(8,Math.max(1,Number(process.env.COMMUNES_OCR_PAGES)||6));
  const info=cp.spawnSync('pdfinfo',[file],{encoding:'utf8',timeout:4000}),total=Number((info.stdout.match(/^Pages:\s+(\d+)/m)||[])[1])||null;
  cp.execFileSync('pdftoppm',['-f','1','-l',String(limit),'-r','130','-scale-to','1700','-png',file,path.join(dir,'page')],{timeout:25000,maxBuffer:1000000});
  const images=fs.readdirSync(dir).filter(n=>/^page-\d+\.png$/.test(n)).sort((a,b)=>Number(a.match(/\d+/)[0])-Number(b.match(/\d+/)[0]));let result=[];
  for(const image of images)result.push(cp.execFileSync('tesseract',[path.join(dir,image),'stdout','-l',language,'--psm','3'],{encoding:'utf8',timeout:10000,maxBuffer:1000000,env:{...process.env,OMP_THREAD_LIMIT:'1'}}));
  return {text:result.join('\f'),method:'ocr',language,pagesRead:images.length,totalPages:total,partial:total===null||total>images.length};
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
}
module.exports={extract};
