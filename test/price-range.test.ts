import {expect,it} from 'vitest';
import {priceRangeOptions} from '../src/web/price-range';
it('uses the matching price bounds in £25k steps and rounds outward',()=>{
 const range=priceRangeOptions([212500,387999]);expect(range.minimum).toBe('200000');expect(range.maximum).toBe('400000');expect(range.options[0]).toBe(200000);expect(range.options.at(-1)).toBe(400000);expect(range.options.every((value,index)=>value===200000+index*25000)).toBe(true);
});
it('preserves exact increments and updates with the matching house types',()=>{
 expect(priceRangeOptions([250000,350000]).minimum).toBe('250000');expect(priceRangeOptions([250000,350000]).maximum).toBe('350000');expect(priceRangeOptions([299950]).minimum).toBe('275000');expect(priceRangeOptions([299950]).maximum).toBe('300000');
});
it('leaves unknown prices unset',()=>{expect(priceRangeOptions([]).minimum).toBe('');expect(priceRangeOptions([]).maximum).toBe('');});
