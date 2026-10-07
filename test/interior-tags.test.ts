import {expect,it} from 'vitest';
import {interiorTags} from '../src/web/interior-tags';
it('separates colour-bearing labels from pattern and furnishing tags',()=>{
 const tags=interiorTags({mainCategory:'Bedroom',subCategory:'Double Bedroom',isRoom:true,objects:['Gold Lamp'],colours:['Blue'],chairs:['Boucle Chair'],decor:['Blue Decor'],wallpaperTags:['Floral Wallpaper','Green Wallpaper'],fabricTags:['Geometric Cushion'],hasTelevision:false,hasComputer:false});
 expect(tags.colour).toEqual(['Blue','Blue Decor','Gold Lamp','Green Wallpaper']);
 expect(tags.tag).toEqual(['Boucle Chair','Floral Wallpaper','Geometric Cushion']);
 expect(interiorTags()).toEqual({colour:[],tag:[]});
});
