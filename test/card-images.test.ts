import {expect,it} from 'vitest';
import {randomRoomImages,type CardImage} from '../src/web/card-images';
const images:CardImage[]=[{src:'/k1',alt:'Kitchen 1',roomType:'Kitchen'},{src:'/k2',alt:'Kitchen 2',roomType:'Kitchen'},{src:'/k3',alt:'Kitchen 3',roomType:'Kitchen'},{src:'/l1',alt:'Living 1',roomType:'Living Room'},{src:'/l2',alt:'Living 2',roomType:'Living Room'},{src:'/b1',alt:'Bathroom 1',roomType:'Bathroom'}];
it('draws across room types before repeating and retains the collection membership',()=>{
 const result=randomRoomImages(images,()=>.2);
 expect(new Set(result.slice(0,3).map(i=>i.roomType)).size).toBe(3);
 expect(result.map(i=>i.src).sort()).toEqual(images.map(i=>i.src).sort());
 expect(result[2]?.roomType).not.toBe(result[3]?.roomType);
});
it('randomises the starting image and order',()=>{expect(randomRoomImages(images,()=>.1)).not.toEqual(randomRoomImages(images,()=>.9));});
it('deduplicates shared photos, supports a single room and handles empty collections',()=>{
 expect(randomRoomImages([...images,images[0]!])).toHaveLength(images.length);
 expect(randomRoomImages(images.slice(0,3),()=>.3)).toHaveLength(3);
 expect(randomRoomImages([])).toEqual([]);
 expect(randomRoomImages([images[0]!])).toEqual([images[0]]);
});
it('pins the builder logo first while randomising only the room photos',async()=>{
 const {cardImageCollection}=await import('../src/web/card-images');
 const logo:CardImage={src:'/logos/builder.svg',alt:'Builder logo',kind:'logo',background:'#fff'};
 const collection=cardImageCollection(images,logo);
 expect(collection.image).toBe(logo.src);
 expect(collection.description).toBe(logo.alt);
 expect(collection.images[0]).toEqual(logo);
 expect(collection.images.slice(1).map(i=>i.src).sort()).toEqual(images.map(i=>i.src).sort());
 expect(new Set(collection.images.slice(1,4).map(i=>i.roomType)).size).toBe(3);
});
it('chooses a random exterior immediately after the logo without duplicating it',async()=>{
 const {cardImageCollection}=await import('../src/web/card-images');
 const logo:CardImage={src:'/logos/builder.svg',alt:'Builder logo',kind:'logo'};
 const exterior1:CardImage={src:'/outside1',alt:'Front elevation',roomType:'Exterior'};
 const exterior2:CardImage={src:'/outside2',alt:'Rear elevation',roomType:'Exterior'};
 const pool=[...images,exterior1,exterior2];
 const a=cardImageCollection(pool,logo,()=>.1),b=cardImageCollection(pool,logo,()=>.9);
 expect(a.images.slice(0,2)).toEqual([logo,exterior1]);
 expect(b.images.slice(0,2)).toEqual([logo,exterior2]);
 expect(new Set(a.images.map(i=>i.src)).size).toBe(pool.length+1);
 expect(a.images.slice(1).map(i=>i.src).sort()).toEqual(pool.map(i=>i.src).sort());
});
it('does not pin exterior images in collections without a builder logo',async()=>{
 const {cardImageCollection}=await import('../src/web/card-images');
 const exterior:CardImage={src:'/outside',alt:'Exterior',roomType:'Exterior'};
 const result=cardImageCollection([...images,exterior],undefined,()=>.2);
 expect(new Set(result.images.slice(0,4).map(i=>i.roomType)).size).toBe(4);
});
it('starts building previews with a front exterior then an interior from the same pool',async()=>{
 const {buildingCardImageCollection}=await import('../src/web/card-images');
 const rear:CardImage={src:'/rear',alt:'Rear garden',roomType:'Exterior'};
 const front:CardImage={src:'/front',alt:'Front elevation of the home',roomType:'Exterior'};
 const pool=[rear,...images,front];
 const result=buildingCardImageCollection(pool,()=>.2);
 expect(result.images[0]).toEqual(front);
 expect(images).toContainEqual(result.images[1]);
 expect(result.images.map(i=>i.src).sort()).toEqual(pool.map(i=>i.src).sort());
});
it('starts with an interior when only rear exteriors or no exterior exist',async()=>{
 const {buildingCardImageCollection}=await import('../src/web/card-images');
 const rear:CardImage={src:'/rear',alt:'Rear elevation',roomType:'Exterior'};
 expect(images).toContainEqual(buildingCardImageCollection([rear,...images],()=>.1).images[0]);
 expect(images).toContainEqual(buildingCardImageCollection(images,()=>.8).images[0]);
 expect(buildingCardImageCollection([]).images).toEqual([]);
});
