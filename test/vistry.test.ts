import { expect, it } from 'vitest';
import { createVistryParser } from '../src/adapters/vistry/site-parser';
const origin = 'https://www.bovishomes.co.uk';
const parser = createVistryParser(origin);
it('discovers developments without treating plot URLs as developments', () => {
 expect(parser.developmentUrls(`<urlset><url><loc>${origin}/developments/kent/park</loc></url><url><loc>${origin}/developments/kent/park/home-001</loc></url></urlset>`)).toEqual([origin+'/developments/kent/park']);
});
it('loads advertised plots, retains low bedroom counts and removes featured duplicates', async () => {
 const row = '<div class="house-types__house-type-row" data-beds="2" data-price="250000" data-status="Available"><div class="house-types__house-type-number"><a href="/developments/kent/park/home-001"><h3>Home 1 - The Wren</h3></a></div><p class="house-types__beds">2 bedroom semi-detached</p></div>';
 const html = await parser.enrichPage('<h1>Park</h1><div id="houseTypeContentSection"></div><script>fetch(\'/ajax/get-available-plots/123\')</script>', async url => {expect(url).toBe(origin+'/ajax/get-available-plots/123');return JSON.stringify({html:row+row});});
 const homes = parser.discoverHomes(html,origin+'/developments/kent/park').homes;
 expect(homes).toHaveLength(1);expect(homes[0]).toMatchObject({name:'The Wren',plotNumber:'1',bedrooms:2,price:250000,isDetached:false});
});
it('includes floorplans and development photos while dropping responsive variants and logos', () => {
 const cdn='https://cdn.mediavalet.com'; const blob='https://mvdataappstorageeunlprod.blob.core.windows.net';
 const images = parser.galleryImages(`<img src="${origin}/logo.svg"><div class="plot-hero-images__slick"><img src="${cdn}/room.jpg" class="show-above-540"><img src="${cdn}/room-small.jpg" class="show-below-540"></div><div class="floor-plans-desktop"><img src="${blob}/plan.jpg"></div><div class="development-hero-images__slick"><img src="${cdn}/exterior.jpg"></div>`);
 expect(images.map(i=>i.url)).toEqual([cdn+'/room.jpg',blob+'/plan.jpg',cdn+'/exterior.jpg']);
 expect(()=>parser.galleryImages('<div class="plot-hero-images__slick"><img src="https://other.com/x.jpg"></div>')).toThrow();
});

it('retains a development gallery even when no plots are currently advertised', () => {
 const result=parser.discoverHomes('<h1>Park</h1><div class="development-hero-images__slick"><img src="https://cdn.mediavalet.com/home.jpg"></div>',origin+'/developments/kent/park');
 expect(result.plots).toHaveLength(0);
 expect(result.homes[0]).toMatchObject({name:'Park development gallery',bedrooms:null,propertyType:'development',url:origin+'/developments/kent/park'});
});
