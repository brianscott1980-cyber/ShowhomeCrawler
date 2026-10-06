import {expect,it} from 'vitest';
import {bedroomSubCategory} from '../src/vision/bedroom-category';
it('uses bed size regardless of master, guest or child labels',()=>{
 expect(bedroomSubCategory('Master bedroom with a single bed and en-suite')).toBe('Single bedroom');
 expect(bedroomSubCategory('Child bedroom with a double bed')).toBe('Double bedroom');
 expect(bedroomSubCategory('Guest room with a king-size bed')).toBe('Double bedroom');
 expect(bedroomSubCategory('Twin beds')).toBe('Single bedroom');
 expect(bedroomSubCategory('Bunk beds')).toBe('Single bedroom');
});
it('does not guess sizes from room names and handles nurseries or mixed beds',()=>{
 expect(bedroomSubCategory('Large master bedroom with en-suite')).toBe('Bedroom (bed size unclear)');
 expect(bedroomSubCategory('Nursery with a crib')).toBe('Nursery');
 expect(bedroomSubCategory('Double bed and a single bed')).toBe('Double bedroom');
});
it('uses side-by-side sleeping pillows on one bed without mistaking stacked pillows or twin beds',()=>{
 expect(bedroomSubCategory('A bed with two pillows side by side for two people')).toBe('Double bedroom');
 expect(bedroomSubCategory('A single bed with two pillows side by side')).toBe('Single bedroom');
 expect(bedroomSubCategory('A bed with two stacked pillows')).toBe('Bedroom (bed size unclear)');
});
