import {readdir,readFile,writeFile} from 'node:fs/promises';
import {bedroomSubCategory} from '../vision/bedroom-category.js';
import type {RunReport} from '../reports/report.js';
const counts=new Map<string,number>();let updated=0;
for(const root of ['collections','results']){
 const folders=await readdir(root,{withFileTypes:true});
 for(const folder of folders.filter(f=>f.isDirectory()&&f.name.endsWith('-home-offices'))){
  for(const file of ['results.json','checkpoint.json']){
   const path=`${root}/${folder.name}/${file}`;
   let report:RunReport;try{report=JSON.parse(await readFile(path,'utf8'));}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')continue;throw error;}
   let changed=false;
   for(const image of report.images){
    if(image.categorisation?.mainCategory!=='Bedroom')continue;
    const sub=bedroomSubCategory(image.verdict?.description,image.verdict?.roomType,image.verdict?.reason,image.categorisation.subCategory);
    if(root==='collections'&&file==='results.json')counts.set(sub,(counts.get(sub)??0)+1);
    if(sub!==image.categorisation.subCategory){image.categorisation.subCategory=sub;changed=true;updated++;}
    const cache=`results/.cache/categorisation/${image.id}.json`;
    try{const cat=JSON.parse(await readFile(cache,'utf8'));if(cat.mainCategory==='Bedroom'&&cat.subCategory!==sub){cat.subCategory=sub;await writeFile(cache,JSON.stringify(cat,null,2));}}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
   }
   if(changed)await writeFile(path,JSON.stringify(report,null,2));
  }
 }
}
console.log({updated,publishedBedrooms:Object.fromEntries(counts)});
