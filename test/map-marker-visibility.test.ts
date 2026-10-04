import {expect,it,vi} from 'vitest';
import {fullyVisibleSiteKeys,markerFitsViewport} from '../src/web/map-marker-visibility';
const size={width:100,height:100};
const point=(x:number,y:number,properties:Record<string,unknown>)=>({geometry:{type:'Point' as const,coordinates:[x,y]},properties});
const project=([x,y]:[number,number])=>({x,y});
it('requires the entire marker on all four edges, allowing an exact fit',()=>{
 expect(markerFitsViewport({x:9,y:9},9,size)).toBe(true);
 for(const position of [{x:8,y:50},{x:92,y:50},{x:50,y:8},{x:50,y:92}])expect(markerFitsViewport(position,9,size)).toBe(false);
});
it('constrains marker visibility to a focus area when specified',()=>{
 const focusArea={left:30,top:20,right:80,bottom:80};
 expect(markerFitsViewport({x:50,y:50},9,size,focusArea)).toBe(true);
 // Marker outside the focus area left boundary
 expect(markerFitsViewport({x:35,y:50},9,size,focusArea)).toBe(false);
 // Marker outside the focus area right boundary
 expect(markerFitsViewport({x:75,y:50},9,size,focusArea)).toBe(false);
});
it('accounts for the initial badge at every zoom when filtering sites',async()=>{
 const features=[point(10,50,{key:'edge'}),point(16,50,{key:'fits'})];
 expect(await fullyVisibleSiteKeys(features,project,size,14,vi.fn())).toEqual(['fits']);
 expect(await fullyVisibleSiteKeys(features,project,size,15,vi.fn())).toEqual(['fits']);
});
it('lists members only of fully visible clusters, including outlines and deduplicating tile copies',async()=>{
 const features=[point(20,50,{cluster_id:1,point_count:2}),point(25,50,{cluster_id:2,point_count:20}),point(25,50,{cluster_id:2,point_count:20}),point(50,50,{key:'dot'})];
 const leaves=vi.fn(async()=>[{properties:{key:'cluster-member'}}]);
 expect(await fullyVisibleSiteKeys(features,project,size,10,leaves)).toEqual(['cluster-member','dot']);
 expect(leaves).toHaveBeenCalledTimes(1);expect(leaves).toHaveBeenCalledWith(2,20);
});
