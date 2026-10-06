import {expect,it} from 'vitest';
import {directoryIdentityEncoder,directoryPreview} from '../src/web/directory-payload';
it('bounds carousel previews without changing full counts or mutating source data',()=>{
 const card={count:100,images:Array.from({length:100},(_,id)=>({src:String(id)})),image:'0'};
 const preview=directoryPreview(card);expect(preview.images).toHaveLength(12);expect(preview.images[0]).toEqual({src:'0'});expect(preview.count).toBe(100);expect(card.images).toHaveLength(100);
});
it('preserves shared image identity and distinct builder identities for filtered counts',()=>{
 const encode=directoryIdentityEncoder();const ids=['a:image1','a:image1','b:image1','a:image2'];
 expect(new Set(ids.map(encode)).size).toBe(new Set(ids).size);expect(encode('a:image1')).toBe(encode('a:image1'));expect(encode('a:image1')).not.toBe(encode('b:image1'));
});
import {compactDirectoryPlaces} from '../src/web/directory-payload';
it('merges equivalent places without losing images or merging different bedroom filters',()=>{
 const base={siteId:'a:site',developer:'A',bedrooms:3,locations:['Scotland']};
 const places=compactDirectoryPlaces([{...base,imageIds:['1','2']},{...base,imageIds:['2','3']},{...base,bedrooms:4,imageIds:['4']}]);
 expect(places).toHaveLength(2);expect(places[0]?.imageIds).toEqual(['1','2','3']);expect(places[1]?.bedrooms).toBe(4);expect(new Set(places.flatMap(p=>p.imageIds)).size).toBe(4);
});
