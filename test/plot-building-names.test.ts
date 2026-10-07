import {expect,it} from 'vitest';
import {isPlotName} from '../src/reports/home-display';
it('excludes plot identifiers rather than treating them as building types',()=>{
 for(const name of ['12 The Aspen','Development Overview','The Development','123','123,','123, Available','Plot 12','The Aspen · Plot 7','Plot 8 - The Birch'])expect(isPlotName(name)).toBe(true);
 for(const name of ['The Aspen','Type 123','The Plotter'])expect(isPlotName(name)).toBe(false);
});
