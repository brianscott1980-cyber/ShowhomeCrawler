import { expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
vi.mock('../src/web/homepage-data', () => ({ homepageData: async () => ({ hero: {src:'/hero.jpg',alt:'A living room',builder:'Bellway',category:'Living Room'},journeyPhotos:[],featured:[],points:[{latitude:52,longitude:-1,name:'Test site'}],counts:{locations:12,builders:3,buildings:8} }) }));
import Home from '../src/app/page';
import { CoverageMap, coverageClusters, projectLocation } from '../src/web/coverage-map';
it('gives the homepage three distinct journeys and a real coverage overview', async () => {
 const dom=new JSDOM(renderToStaticMarkup(await Home()));const doc=dom.window.document;
 expect(doc.querySelectorAll('h1')).toHaveLength(1);
 expect([...doc.querySelectorAll('.home-journey')].map(a=>a.getAttribute('href'))).toEqual(['/locations','/interiors','/buildings']);
 expect(doc.querySelector('[href="/homebuilders"]')).not.toBeNull();
 expect(doc.querySelector('.home-coverage-counts')?.textContent).toContain('Locations12');
 expect(doc.querySelector('.home-map svg title')?.textContent).toContain('United Kingdom');
 expect(doc.querySelectorAll('.home-map .map-site')).toHaveLength(1);
 expect(doc.querySelector('.home-saved a')?.getAttribute('href')).toBe('/favourites');
 dom.window.close();
});
it('projects northern locations above southern ones and clusters points without losing their counts',()=>{
 const north=projectLocation({latitude:57,longitude:-2}),south=projectLocation({latitude:51,longitude:-2});
 expect(north.y).toBeLessThan(south.y);expect(north.x).toBe(south.x);
 const points=[{latitude:52,longitude:-1,name:'A'},{latitude:52,longitude:-1,name:'B'},{latitude:57,longitude:-3,name:'C'}];
 const clusters=coverageClusters(points);expect(clusters).toHaveLength(2);expect(clusters.reduce((sum,c)=>sum+c.count,0)).toBe(3);
 const dom=new JSDOM(renderToStaticMarkup(<CoverageMap points={points}/>));expect(dom.window.document.querySelector('desc')?.textContent).toContain('3 mapped locations');dom.window.close();
});
