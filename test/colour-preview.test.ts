import {expect,it} from 'vitest';
import {colourPreview} from '../src/web/colour-preview';
it('matches colour words in tags and supports mixed colour swatches',()=>{
 expect(colourPreview('Blue Decor')).toBe('#3779c2');
 expect(colourPreview('Gold Lamp')).toBe('#c4a052');
 expect(colourPreview('Cream / Neutral')).toContain('linear-gradient');
 expect(colourPreview('Blue Blue Wallpaper')).toBe('#3779c2');
 expect(colourPreview('Floral Wallpaper')).toBeUndefined();
});
