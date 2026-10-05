import {expect,it} from 'vitest';
import {developmentUrls,discoverHomes,galleryImages} from '../src/adapters/bargate/site-parser';
it('finds development and house-type URLs without collecting other development recommendations',()=>{
 expect(developmentUrls('<urlset><url><loc>https://www.bargatehomes.co.uk/developments/admirals-green-development/</loc></url><url><loc>https://www.bargatehomes.co.uk/house-type/the-breakwater/</loc></url></urlset>')).toEqual(['https://www.bargatehomes.co.uk/developments/admirals-green-development/']);
 const result=discoverHomes('<header><h1>Admirals Green</h1></header><article><h2>The Breakwater</h2><p>4 bedrooms £500,000</p><a href="/house-type/the-breakwater/">View home</a></article>','https://www.bargatehomes.co.uk/developments/admirals-green-development/');
 expect(result.plots[0]).toMatchObject({name:'The Breakwater',bedrooms:4,price:500000});
});
it('limits media to the current gallery and accepts the official CDN',()=>{
 const images=galleryImages('<header><img src="https://cdn.bargatehomes.co.uk/logo.png"></header><div class="wp-block-bargate-homes-media-carousel"><img src="https://cdn.bargatehomes.co.uk/uploads/kitchen.jpg" alt="Kitchen"><img src="https://cdn.bargatehomes.co.uk/uploads/kitchen.jpg"><img src="https://other.test/room.jpg"><img src="https://cdn.bargatehomes.co.uk/logo.svg"></div><aside><img src="https://cdn.bargatehomes.co.uk/other-home.jpg"></aside>');
 expect(images).toEqual([{url:'https://cdn.bargatehomes.co.uk/uploads/kitchen.jpg',position:0,altText:'Kitchen'}]);
});
