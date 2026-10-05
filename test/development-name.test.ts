import {describe,expect,it} from 'vitest';
import {developmentName} from '../src/web/development-name';

describe('development display names',()=>{
 it.each([
  ["Aylett's Green, Kelvedon, Essex", "Aylett's Green"],
  ['Barratt Homes @ Alconbury Weald','Alconbury Weald'],
  ['Barrat @ West Craigs','West Craigs'],
  ['Barrat at Overstone Gate','Overstone Gate'],
  ['CALA Homes at Oak Place, Essex','Oak Place'],
  ['David Wilson Homes @ Oak Place','Oak Place'],
  ['The Homes at Oak Place','The Homes at Oak Place'],
  ['Village at the Park','Village at the Park'],
 ])('displays %s as %s',(name,expected)=>expect(developmentName(name)).toBe(expected));
});
