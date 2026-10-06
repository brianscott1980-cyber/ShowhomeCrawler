import {expect,it} from 'vitest';
import {decorDetails} from '../src/vision/decor-details';
it('keeps colour, pattern and repeated accents independent',()=>{
 const details=decorDetails('Blue floral wallpaper, green geometric curtains, blue cushions and blue ornaments. Green striped bedding.',['Blue','Green']);
 expect(details.decor).toContain('Blue decor');
 expect(details.wallpaperTags).toEqual(expect.arrayContaining(['Blue wallpaper','Floral wallpaper']));
 expect(details.curtainTags).toEqual(expect.arrayContaining(['Green curtains','Geometric curtains']));
 expect(details.fabricTags).toEqual(expect.arrayContaining(['Green bedding','Striped bedding','Blue cushions']));
 expect(decorDetails('One blue cushion',['Blue']).decor).toEqual([]);
});
it('records independent attributes of furnishings',()=>{
 const details=decorDetails('A gold geometric lamp, round brass mirror and boucle armchair beside a marble table.',['Gold']);
 expect(details.furnishingTags).toEqual(expect.arrayContaining(['Gold lamp','Geometric lamp','Round mirror','Brass mirror','Bouclé armchair','Marble table']));
});
