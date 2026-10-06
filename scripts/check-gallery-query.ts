import {queryGallery} from '../src/database/gallery-query';
import {cachedDirectory} from '../src/database/directory-cache';
import {websiteDatabase} from '../src/database/website';
try{
 for(const scope of [{kind:'buildings' as const,href:'/buildings/bellway/theavondale'},{kind:'interiors' as const,href:'/interiors/bedroom'}]){
  const started=Date.now(),data=await queryGallery({scope});console.log(scope.href,{ms:Date.now()-started,total:data.total,images:data.images.length,counts:data.counts,bytes:JSON.stringify(data).length,facets:Object.fromEntries(Object.entries(data.facets).map(([k,v])=>[k,v.length]))});
 }
 for(let i=0;i<2;i++){const t=Date.now(),data=await cachedDirectory({kind:'buildings'});console.log('directory',i,Date.now()-t,data.total);}
}finally{await websiteDatabase().end();}
