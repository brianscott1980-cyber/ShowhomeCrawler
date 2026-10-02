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
