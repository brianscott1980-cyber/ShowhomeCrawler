import { expect, it } from 'vitest';
import { discoverHomes, developmentUrls, galleryImages } from '../src/adapters/taylor-wimpey/site-parser';
it('discovers developments, excluding plot pages', () => {
 expect(developmentUrls('<urlset><url><loc>https://www.taylorwimpey.co.uk/new-homes/shifnal/acorn-green</loc></url><url><loc>https://www.taylorwimpey.co.uk/new-homes/shifnal/acorn-green/plot-15</loc></url></urlset>')).toHaveLength(1);
});
it('reads all embedded plots even when the initial visible limit is smaller', () => {
 const data = { InitialNumberOfPlotsToShow: 1, Plots: [1,2].map(n => ({ HouseType: 'The Garrton', PlotPageUrl: `/new-homes/town/site/plot-${n}`, PlotNumber: n, NoOfBedrooms: 5, Price: 600000, PropertyType: 'Detached' })) };
 const html = `<h1>Site</h1><development-plots-list :vm='${JSON.stringify(data)}'></development-plots-list>`;
 expect(discoverHomes(html, 'https://www.taylorwimpey.co.uk/new-homes/town/site').homes).toHaveLength(2);
});
it('keeps proposed developments explicit', () => {
 expect(discoverHomes('<h1>Land</h1><title>Proposed new homes</title>', 'https://www.taylorwimpey.co.uk/new-homes/town/land').plotError).toContain('No current plot list');
});
it('reads gallery images without unrelated page assets', () => {
 expect(galleryImages('<image-gallery-image url="/-/twdxmedia/study.jpg?hash=abc" alt="Study"></image-gallery-image><smart-media-gallery-swiper><template><div data-is-video="false"><img data-src="/-/twdxmedia/second.jpg?hash=def"></div><div data-is-video="true"><img data-src="/-/twdxmedia/video.jpg"></div></template></smart-media-gallery-swiper><img src="/logo.png">')).toHaveLength(2);
});
