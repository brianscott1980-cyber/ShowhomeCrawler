import {mkdir,writeFile} from 'node:fs/promises';
import {computeHomepageData} from '../src/web/homepage-data';
const started=performance.now();
const data=await computeHomepageData();
await mkdir('.generated',{recursive:true});
await writeFile('.generated/homepage.json',JSON.stringify(data));
console.log(`Homepage snapshot: ${data.points.length} developments in ${Math.round(performance.now()-started)}ms`);
