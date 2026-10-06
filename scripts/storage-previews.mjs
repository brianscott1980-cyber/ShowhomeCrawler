import sharp from 'sharp';
import {readFile,mkdir} from 'node:fs/promises';
const items=JSON.parse(await readFile(process.argv[2],'utf8'));
await mkdir('.showhome/previews',{recursive:true});
let next=0;
await Promise.all(Array.from({length:4},async()=>{while(next<items.length){const item=items[next++];await sharp(item.source,{animated:false}).resize({width:480,height:360,fit:'inside',withoutEnlargement:true}).webp({quality:65}).toFile(item.target)}}));
