import {expect,it} from 'vitest';
import {homeTypeName} from '../src/reports/home-display';
it('normalises uppercase building titles while preserving mixed case',()=>{
 expect(homeTypeName('THE HAVERSHAM')).toBe('The Haversham');
 expect(homeTypeName('THE DOUBLE-FRONTED HOME')).toBe('The Double-Fronted Home');
 expect(homeTypeName('Haversham · HAVERSHAM')).toBe('Haversham');
 expect(homeTypeName('The McArthur')).toBe('The McArthur');
});
