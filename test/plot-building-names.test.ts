import {expect,it} from 'vitest';
import {isPlotName} from '../src/reports/home-display';
it('excludes plot identifiers rather than treating them as building types',()=>{
 for(const name of ['Ground Floor','Second Floor','Third Floor','1st Floor','Floor 2','F1','F2','F3','Type 1','Apartment 4','Property 3','Home 2','Block A','The Block','12 The Aspen','Development Overview','The Development','123','123,','123, Available','Plot 12','The Aspen · Plot 7','Plot 8 - The Birch'])expect(isPlotName(name)).toBe(true);
 for(const name of ['The Aspen','The Plotter','Blockley','Apartment','The Homewood'])expect(isPlotName(name)).toBe(false);
});
