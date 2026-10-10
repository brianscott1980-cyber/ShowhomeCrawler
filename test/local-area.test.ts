import {expect,it} from 'vitest';
import {mappedPlaces,areaSummary,distanceLabels,distanceMiles} from '../src/enrichment/local-area';
import {hbfAnnual,profileReview} from '../src/enrichment/builder-research';
it('uses mapped distances and keeps facilities outside one mile out of the area statement',()=>{
 const point={latitude:51,longitude:0};const places=mappedPlaces([{type:'node',id:1,lat:51.001,lon:0,tags:{name:'Local Park',leisure:'park'}},{type:'node',id:2,lat:51.05,lon:0,tags:{name:'Far Station',railway:'station'}},{type:'way',id:3,center:{lat:51.001,lon:0},tags:{name:'Local Park',leisure:'park'}}],point);
 expect(places).toHaveLength(2);expect(distanceMiles(point,{latitude:51.001,longitude:0})).toBeCloseTo(0.069,3);
 expect(areaSummary(places,['node/1','node/2','invented'])).toContain('Local Park');expect(areaSummary(places,['node/2'])).toBe('');expect(distanceLabels(places).find(p=>p.kind==='rail')?.name).toBe('Far Station');
});
it('does not treat subway stops or anonymous shops as national rail stations or retail centres',()=>{expect(mappedPlaces([{type:'node',id:1,lat:51,lon:0,tags:{name:'Tube',railway:'station',station:'subway'}},{type:'node',id:2,lat:51,lon:0,tags:{shop:'supermarket'}}],{latitude:51,longitude:0})).toEqual([]);});
it('uses the latest annual HBF survey rather than rolling or older data',()=>{const html='<script type="application/json">'+JSON.stringify([{date:'2026-03-01',annual:true,name:'2026',results:[]},{date:'2026-09-01',annual:false,results:[]},{date:'2025-03-01',annual:true,results:[]}])+'</script>';expect(hbfAnnual(html).name).toBe('2026');});
it('rejects ratings from a different Trustpilot business profile',()=>{const html='<script type="application/ld+json">'+JSON.stringify({url:'https://www.trustpilot.com/review/wrong',aggregateRating:{ratingValue:4.8,reviewCount:50}})+'</script>';expect(profileReview(html,'https://www.trustpilot.com/review/right')).toBeUndefined();});
