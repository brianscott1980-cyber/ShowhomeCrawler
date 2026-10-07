import {readFurnishings} from '../database/furnishings';
import {websiteDatabase} from '../database/website';
import {cachedDirectory} from '../database/directory-cache';
import {cachedGallery} from '../database/gallery-cache';
import {homepageData} from '../web/homepage-data';
// Local builds stay offline unless explicitly enabled. Vercel builds warm automatically.
const deployOnly=process.argv.includes('--deploy-only');
if(deployOnly&&process.env.VERCEL!=='1'&&process.env.WARM_WEBSITE_CACHES!=='true'){
 console.log('Website cache warm-up skipped for local build. Run npm run website:warm to warm explicitly.');
}else{
 const sql=websiteDatabase();let failures=0;
 const warm=async(label:string,run:()=>Promise<unknown>)=>{
  const started=Date.now();
  try{await run();console.log(`Cache ready: ${label} (${((Date.now()-started)/1000).toFixed(1)}s)`);}
  catch(error){failures++;console.error(`Cache warm-up failed: ${label}`,error instanceof Error?error.message:String(error));}
 };
 try{
  await warm('Homepage',()=>homepageData());
  // Sequential queries avoid competing with each other on the small database pool.
  for(const kind of ['builders','locations','buildings','interiors'] as const)await warm(`${kind} directory and counts`,()=>cachedDirectory({kind,offset:0,limit:16},sql));
  await warm('Furnishings directory',()=>readFurnishings());
  const rooms=await sql`select distinct href from showhome_web.directory_cards where kind='interiors' and lower(trim(coalesce(category,''))) not in ('exterior','floorplan','floor plan','other','uncategorised','uncategorized','unknown','infographic','illustration','promotional graphic','marketing image','document','logo','map') order by href`;
  const hrefs=new Set(['/interiors/all',...rooms.map(room=>String(room.href))]);
  for(const href of hrefs)await warm(`${href} gallery and counts`,()=>cachedGallery({scope:{kind:'interiors',href},offset:0,limit:16},sql));
  console.log(`Website cache warm-up complete: ${failures} failures.`);
 }catch(error){failures++;console.error('Website cache warm-up interrupted:',error instanceof Error?error.message:String(error));}
 finally{await sql.end();}
 // Report failures without discarding a successful deployment. Cold queries can still fill caches.
 if(failures&&!deployOnly)process.exitCode=1;
}
