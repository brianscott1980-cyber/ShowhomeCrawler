import { expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
vi.mock('../src/web/homepage-data', () => ({ homepageData: async () => ({ hero: {src:'/hero.jpg',alt:'A living room',builder:'Bellway',category:'Living Room'},journeyPhotos:[],featured:[],mapPhotos:[],points:[{latitude:52,longitude:-1,name:'Test site',builder:'Bellway'}],counts:{locations:12,builders:3,buildings:8} }) }));
import Home from '../src/page-views/page';
import { CoverageMap, coverageClusters, projectLocation } from '../src/web/coverage-map';
it('gives the homepage three distinct journeys and a real coverage overview', async () => {
 const dom=new JSDOM(renderToStaticMarkup(await Home()));const doc=dom.window.document;
 expect(doc.querySelectorAll('h1')).toHaveLength(1);
 expect([...doc.querySelectorAll('.home-journey')].map(a=>a.getAttribute('href'))).toEqual(['/developments','/interiors','/buildings']);
 expect(doc.querySelector('[href="/builders"]')).not.toBeNull();
 expect(doc.querySelector('.home-coverage-counts')?.textContent).toContain('Developments12');
 expect(doc.querySelector('.home-map svg')?.getAttribute('aria-label')).toContain('United Kingdom');
 expect(doc.querySelectorAll('.home-map .map-site')).toHaveLength(1);
 expect(doc.querySelector('.home-saved a')?.getAttribute('href')).toBe('/favourites');
 dom.window.close();
});
it('projects northern locations above southern ones and clusters points without losing their counts',()=>{
 const north=projectLocation({latitude:57,longitude:-2}),south=projectLocation({latitude:51,longitude:-2});
 expect(north.y).toBeLessThan(south.y);expect(north.x).toBe(south.x);
 const points=[{latitude:52,longitude:-1,name:'A',builder:'Bellway'},{latitude:52,longitude:-1,name:'B',builder:'Bellway'},{latitude:57,longitude:-3,name:'C',builder:'Cala'}];
 const clusters=coverageClusters(points);expect(clusters).toHaveLength(2);expect(clusters.reduce((sum,c)=>sum+c.count,0)).toBe(3);
 const dom=new JSDOM(renderToStaticMarkup(<CoverageMap points={points}/>));expect(dom.window.document.querySelector('desc')?.textContent).toContain('3 mapped developments');dom.window.close();
});

it('keeps builders separate in shared map cells and gives them different labelled colours',()=>{
 const points=[{latitude:52,longitude:-1,name:'A',builder:'Bellway'},{latitude:52,longitude:-1,name:'B',builder:'Cala'}];
 expect(coverageClusters(points)).toHaveLength(2);
 const dom=new JSDOM(renderToStaticMarkup(<CoverageMap points={points}/>));
 const circles=[...dom.window.document.querySelectorAll('.map-site')];
 expect(new Set(circles.map(c=>c.getAttribute('fill'))).size).toBe(2);
 expect(circles.map(c=>c.getAttribute('aria-label'))).toEqual(['Bellway: 1 development','Cala: 1 development']);
 expect(dom.window.document.querySelector('.home-map-legend')).toBeNull();
 expect(dom.window.document.querySelector('.home-map title')).toBeNull();
 dom.window.close();
});

it('highlights only the associated site, even when another builder site is nearby',()=>{
 const points=[{latitude:52,longitude:-1,name:'A',builder:'Bellway',siteId:'a'},{latitude:52.001,longitude:-1,name:'B',builder:'Bellway',siteId:'b'}];
 const dom=new JSDOM(renderToStaticMarkup(<CoverageMap points={points} activeSiteIds={['a']}/>));
 expect(dom.window.document.querySelectorAll('.map-site')).toHaveLength(2);
 expect(dom.window.document.querySelectorAll('.is-active-site')).toHaveLength(1);
 expect(dom.window.document.querySelector('.home-map')?.classList.contains('has-active-sites')).toBe(true);
 dom.window.close();
});
