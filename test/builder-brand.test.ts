import {expect,it} from 'vitest';
import {developers} from '../src/adapters/developers';
import {builderBrands,brandTextColour} from '../src/web/builder-brand';
const luminance=(hex:string)=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i]!,0);
it('preserves every builder name and keeps both text colours legible on cards and headers',()=>{
 for(const developer of developers){const brand=builderBrands[developer.slug];expect(brand.parts.join('')).toBe(developer.name);
  for(const colour of [brand.primary,brand.secondary])for(const background of ['#ffffff','#15243a']){
   const text=luminance(brandTextColour(colour,background)),back=luminance(background);
   expect((Math.max(text,back)+.05)/(Math.min(text,back)+.05)).toBeGreaterThanOrEqual(4.5);
  }
 }
});
