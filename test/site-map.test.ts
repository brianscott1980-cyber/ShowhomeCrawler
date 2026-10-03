import {describe,it,expect} from 'vitest';
import {hasCoordinates,inMapBounds} from '../src/web/site-map';
import type {SiteCard} from '../src/web/site-filters';
const site={key:'one',name:'Site',developer:'Builder',image:'',description:'',count:1,country:'England',properties:[],latitude:52,longitude:-1} satisfies SiteCard;
describe('map viewport results',()=>{
 it('includes sites on the viewport boundary and excludes sites outside it',()=>{
  const bounds={west:-1,east:2,south:50,north:52};
  expect(inMapBounds(site,bounds)).toBe(true);
  expect(inMapBounds({...site,latitude:53},bounds)).toBe(false);
  expect(inMapBounds({...site,longitude:-2},bounds)).toBe(false);
 });
 it('rejects missing or invalid coordinates',()=>{
  expect(hasCoordinates({...site,latitude:undefined})).toBe(false);
  expect(hasCoordinates({...site,longitude:NaN})).toBe(false);
  expect(hasCoordinates({...site,latitude:91})).toBe(false);
 });
 it('handles a viewport crossing the date line and repeated worlds',()=>{
  expect(inMapBounds({...site,longitude:-175},{west:170,east:190,south:50,north:55})).toBe(true);
  expect(inMapBounds(site,{west:350,east:370,south:50,north:55})).toBe(true);
 });
});
