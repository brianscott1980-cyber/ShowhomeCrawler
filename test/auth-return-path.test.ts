import {describe,it,expect} from 'vitest';
import {safeReturnPath} from '../src/auth/return-path';
describe('OAuth return destination',()=>{
 it('preserves a local page, filters and fragment',()=>expect(safeReturnPath('/interiors?room=Kitchen#photos')).toBe('/interiors?room=Kitchen#photos'));
 it.each(['https://evil.example','//evil.example','/\\evil.example','/auth/callback?code=old','/\n/evil.example'])('rejects unsafe or looping destination %s',value=>expect(safeReturnPath(value)).toBe('/'));
 it('defaults missing paths to home',()=>expect(safeReturnPath(null)).toBe('/'));
});
