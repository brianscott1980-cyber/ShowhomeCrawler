import {expect,it} from 'vitest';
import {developmentSlug,developmentPublicRoutes} from '../src/web/development-public-routes';
it('uses readable names and resolves old URLs to the same canonical development',()=>{
 const source='/developments/david-wilson/dwheagleshamview';
 const routes=developmentPublicRoutes([{name:'DWH @ Eaglesham View',href:source}],['david-wilson']);
 expect(routes.canonical[source]).toBe('/developments/eaglesham-view');
 expect(routes.destinations['/developments/eaglesham-view']).toEqual({source,canonical:'/developments/eaglesham-view'});
 expect(routes.destinations[source]).toEqual(routes.destinations['/developments/eaglesham-view']);
 expect(developmentSlug("Aylett’s Green, Kelvedon, Essex")).toBe('ayletts-green');
});
it('keeps shared names and builder landing slugs qualified, independent of ordering',()=>{
 const rows=[{name:'Abbey View',href:'/developments/barratt/abbeyview'},{name:'Abbey View',href:'/developments/bellway/abbeyview'},{name:'Avant',href:'/developments/builder/avant'}];
 const routes=developmentPublicRoutes(rows,['avant']);
 expect(Object.entries(routes.canonical).every(([source,canonical])=>source===canonical)).toBe(true);
 expect(routes.destinations['/developments/abbey-view']).toBeUndefined();
 expect(routes.destinations['/developments/avant']).toBeUndefined();
 expect(developmentPublicRoutes([...rows].reverse(),['avant'])).toEqual(routes);
});
