import sharp from 'sharp';
import {readFile,mkdir,writeFile,rename} from 'node:fs/promises';
const items=JSON.parse(await readFile(process.argv[2],'utf8'));
await mkdir('.showhome/previews',{recursive:true});
const failurePath='.showhome/preview-failures.json';
let failures={};
try{failures=JSON.parse(await readFile(failurePath,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
let next=0;
await Promise.all(Array.from({length:4},async()=>{
 while(next<items.length){
  const item=items[next++];
  try{
   await sharp(item.source,{animated:false}).resize({width:480,height:360,fit:'inside',withoutEnlargement:true}).webp({quality:65}).toFile(item.target);
  }catch(error){
   // Preserve original bytes on the NAS. Only decoder failures get an offline placeholder.
   if(!/unsupported image format|corrupt|invalid image|bad seek|premature end|not a known file format/i.test(error.message))throw error;
   failures[item.target]={source:item.source,error:error.message};
   const placeholder=Buffer.from('<svg width="480" height="360" xmlns="http://www.w3.org/2000/svg"><rect width="480" height="360" fill="#f4f2ea"/><text x="240" y="180" text-anchor="middle" font-family="sans-serif" font-size="18" fill="#20332f">Image preview unavailable</text></svg>');
   await sharp(placeholder).webp({quality:65}).toFile(item.target);
   console.warn('Preview unavailable; verified NAS original retained:',item.source);
  }
 }
}));
await writeFile(failurePath+'.tmp',JSON.stringify(failures,null,2)+'\n');
await rename(failurePath+'.tmp',failurePath);
