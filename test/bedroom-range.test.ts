import {expect,it} from 'vitest';
import {bedroomRangeOptions} from '../src/web/bedroom-range';
it('defaults both limits to Any',()=>{
 const range=bedroomRangeOptions([2,3,4,5],'','');expect(range.minValue).toBe('');expect(range.maxValue).toBe('');
});
it('keeps Any selected after choosing a minimum and offers only valid maxima',()=>{
 const range=bedroomRangeOptions([2,3,4,5,6],'5','any');expect(range.maxValue).toBe('');expect(range.maxNumbers).toEqual([5,6]);
});
it('allows Any for both limits and handles developments without bedroom counts',()=>{
 expect(bedroomRangeOptions([2,3],'any','any').minValue).toBe('');expect(bedroomRangeOptions([],'','').maxValue).toBe('');
});
