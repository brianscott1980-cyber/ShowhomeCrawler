import {mkdir,writeFile} from 'node:fs/promises';
import sharp from 'sharp';
import {developers} from '../src/adapters/developers';
import {builderMapBrand} from '../src/web/builder-map-brand';
const directory=new URL('../public/maps/builders/',import.meta.url);
await mkdir(directory,{recursive:true});
for(const developer of [...developers,{slug:'unknown',name:'Builder'}]){
 const brand=builderMapBrand(developer.name);
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><title>${developer.name} map badge</title><circle cx="32" cy="32" r="29" fill="${brand.primary}" stroke="#fff" stroke-width="4"/><text x="32" y="33" text-anchor="middle" dominant-baseline="central" font-family="Arial,Helvetica,sans-serif" font-size="32" font-weight="700" fill="#fff">${brand.initial}</text></svg>`;
 await writeFile(new URL(`${brand.slug}.svg`,directory),svg+'\n');
 await sharp(Buffer.from(svg)).png().toFile(new URL(`${brand.slug}.png`,directory).pathname);
}
console.log(`Generated ${developers.length} builder map badges and one fallback (SVG and retina PNG).`);
