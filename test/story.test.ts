import { describe, expect, it } from 'vitest';
import { developmentUrls, discoverHomes, galleryImages } from '../src/adapters/story/site-parser';
const url='https://www.storyhomes.co.uk/developments/test-site/';
describe('Story Homes extraction',()=>{
 it('discovers site links without regional listings or foreign links',()=>{
  expect(developmentUrls(`<a href="${url}">Test</a><a href="${url}">Duplicate</a><a href="/developments/">All</a><a href="https://other.test/developments/test/">Other</a>`)).toEqual([url]);
 });
 it('extracts unique advertised plots with bedroom and price metadata',()=>{
  const plot='<div data-plot-link="/plots/test-42/" data-plot-id="42" data-plot-no="42" data-plot-title="The Cranford" data-plot-beds="5" data-plot-price="£500,000"></div>';
  const result=discoverHomes('<h1>Other heading</h1><div class="hero-title">Test Site</div>'+plot+plot,url);
  expect(result.development.name).toBe('Test Site');
  expect(result.homes).toHaveLength(1);
  expect(result.homes[0]).toMatchObject({name:'The Cranford',plotNumber:'42',bedrooms:5,price:500000});
 });
 it('flags unsupported inventory and redirected development pages',()=>{
  expect(()=>discoverHomes('<h1>Test Site</h1>',url)).toThrow('No supported');
  expect(()=>discoverHomes('<link rel="canonical" href="https://www.storyhomes.co.uk/regions/north-west/"><h1>Region</h1>',url)).toThrow('Development no longer exists');
 });
 it('flags missing bedroom metadata rather than treating it as ineligible',()=>{
  expect(()=>discoverHomes('<h1>Test</h1><div data-plot-link="/homes/test/" data-plot-beds="" data-plot-title="Cranford" data-plot-id="1"></div>',url)).toThrow('Missing advertised plot metadata');
 });
 it('limits image extraction to the property hero gallery',()=>{
  expect(galleryImages('<img src="/wp-content/uploads/floorplan.jpg"><div class="hero-slider" data-gallery="gallery_plot_hero"><img class="hero-img" src="/wp-content/uploads/office.jpg"></div>')).toEqual([{url:'https://www.storyhomes.co.uk/wp-content/uploads/office.jpg',position:0,altText:undefined}]);
 });
});
