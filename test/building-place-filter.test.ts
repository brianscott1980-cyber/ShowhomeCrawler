import {expect,it} from 'vitest';
import {matchesBuildingPlace} from '../src/web/building-place-filter';
const places=[{site:'Oak Park',locations:['Edinburgh','Scotland']},{site:'Meadow View',locations:['Leeds','Yorkshire and The Humber','England']}];
it('filters geographical areas separately from development names',()=>{
 expect(matchesBuildingPlace(places,'','Edinburgh')).toBe(true);
 expect(matchesBuildingPlace(places,'Oak Park','')).toBe(true);
 expect(matchesBuildingPlace(places,'','Oak Park')).toBe(false);
});
it('requires selected site and geography to refer to the same development',()=>{
 expect(matchesBuildingPlace(places,'Oak Park','Scotland')).toBe(true);
 expect(matchesBuildingPlace(places,'Oak Park','Leeds')).toBe(false);
 expect(matchesBuildingPlace([{site:'Unknown',locations:[]}],'Unknown','Leeds')).toBe(false);
});
