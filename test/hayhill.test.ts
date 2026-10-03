import {expect,it} from 'vitest';
import {developmentUrls,discoverHomes,galleryImages} from '../src/adapters/hayhill/site-parser';
it('discovers Scottish developments and reads plot names and two-bedroom metadata',()=>{
 expect(developmentUrls('<urlset><url><loc>https://www.hayhilldevelopments.co.uk/development/water-of-coyle-drongan/</loc></url></urlset>')).toHaveLength(1);
 const r=discoverHomes('<h1>Water of Coyle, Drongan</h1><article class="att-plot-list-grid--listing"><a href="/developments/water-of-coyle-drongan/plot-1/"><div class="plot-head"><span>Plot 1</span><span>The Hayside</span><span>Plot 1</span></div><p>2 BEDROOMS £209,995</p></a></article>','https://www.hayhilldevelopments.co.uk/development/water-of-coyle-drongan/');
 expect(r.plots[0]).toMatchObject({name:'The Hayside',bedrooms:2,price:209995});
});
it('extracts lazy gallery photos and floorplan links',()=>{
 expect(galleryImages('<img data-lazy="/wp-content/uploads/kitchen.jpg"><a href="/wp-content/uploads/floorplan.png">Plan</a>').map(i=>i.url)).toHaveLength(2);
});
