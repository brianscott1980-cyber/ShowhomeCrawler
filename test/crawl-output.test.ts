import {it,expect} from 'vitest';
import {resolve} from 'node:path';
import {insideResults} from '../src/crawler/output-folder';
it('accepts native Windows result paths and rejects parent and sibling directories',()=>{
 const root=resolve('results');expect(insideResults(root,resolve('results/bellway-home-offices'))).toBe(true);
 expect(insideResults(root,root)).toBe(false);expect(insideResults(root,resolve('collections/bellway-home-offices'))).toBe(false);
 expect(insideResults(root,resolve('results-other/bellway'))).toBe(false);
});
