import {expect,it} from 'vitest';
import {rememberPageSource,rememberedPageSource} from '../src/web/navigation-memory';
const origin='https://showhome.test';
function storage(){const data=new Map<string,string>();return {getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>{data.set(key,value);}};}
it('restores clean source paths independently for each destination',()=>{
 const session=storage();
 rememberPageSource(session,'/homebuilders?radius=25&region=Scotland&order=distance','/developers/tulloch-homes');
 rememberPageSource(session,'/locations?view=map&lat=57&lng=-4&zoom=8&minBeds=3#collection','/locations/highland');
 expect(rememberedPageSource(session,'/developers/tulloch-homes',origin)).toBe('/homebuilders');
 expect(rememberedPageSource(session,'/locations/highland',origin)).toBe('/locations#collection');
});
it('keeps return URLs clean when revisiting a result with new criteria',()=>{
 const session=storage();
 rememberPageSource(session,'/homebuilders?radius=25','/developers/example');
 rememberPageSource(session,'/homebuilders?radius=50','/developers/example');
 expect(rememberedPageSource(session,'/developers/example',origin)).toBe('/homebuilders');
});
it('keeps nested source pages available and rejects external return URLs',()=>{
 const session=storage();
 rememberPageSource(session,'/homebuilders?radius=25','/developers/example');
 rememberPageSource(session,'/developers/example?radius=25','/locations/example');
 expect(rememberedPageSource(session,'/locations/example',origin)).toBe('/developers/example');
 expect(rememberedPageSource(session,'/developers/example',origin)).toBe('/homebuilders');
 rememberPageSource(session,'https://other.test/','/interiors/example');
 expect(rememberedPageSource(session,'/interiors/example',origin)).toBeNull();
 expect(rememberedPageSource(session,'/buildings/direct-visit',origin)).toBeNull();
});
