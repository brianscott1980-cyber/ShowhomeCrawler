import {describe,expect,it} from 'vitest';
import {developmentUrls,discoverHomes,enrichPage,galleryImages} from '../src/adapters/hill/site-parser';
const url='https://www.hill.co.uk/test';
const row=(number:number,beds:number)=>`<tr class="available-home-row"><td class="views-field-title"><a href="/homes/test-${number}">The Iris, Number ${number}</a></td><td class="views-field-field-plot-num-bedrooms">${beds}</td><td class="views-field-field-plot-type">Detached house</td></tr>`;
describe('Hill source extraction',()=>{
 it('reads the public development index',()=>{expect(developmentUrls('<script type="application/json">{"hgpSearch":{"developments":[{"url":"/test"},{"url":"/test"}]}}</script>')).toEqual([url]);});
 it('preserves house types, plot numbers and bedrooms',()=>{expect(discoverHomes('<h1>Test</h1><table>'+row(78,5)+'</table>',url).homes[0]).toMatchObject({name:'The Iris',plotNumber:'78',bedrooms:5});});
 it('follows inventory pages to find later five-bedroom plots',async()=>{
  const html=`<html><head><link rel="canonical" href="${url}"></head><body><h1>Test</h1><table>${row(1,3)}</table><a href="?page=1">Next</a></body></html>`;
  const enriched=await enrichPage(html,async u=>{expect(u).toBe(url+'?page=1');return `<table>${row(78,5)}</table><a href="?page=0">First</a>`;});
  // Page zero is equivalent to the original inventory and should not duplicate it.
  expect(discoverHomes(enriched,url).homes.some(h=>h.bedrooms===5)).toBe(true);
 });
 it('does not mistake a nearby coming-soon site for an empty current inventory',()=>{
  expect(()=>discoverHomes('<h1>Current</h1><main>Current site Nearby developments Coming soon</main>',url)).toThrow('No supported');
  expect(discoverHomes('<h1>Current</h1><main>ALL HOMES NOW RESERVED</main>',url).homes).toEqual([]);
 });
 it('rejects an inventory whose advertised total is not fully collected',()=>{expect(()=>discoverHomes('<h1>Test</h1><main>Showing 1 of 2 homes available<table>'+row(1,3)+'</table></main>',url)).toThrow('Incomplete plot pagination');});
 it('scopes images to the property gallery',()=>{expect(galleryImages('<img src="/sites/default/files/logo.jpg"><img class="image-style-media-gallery" src="/sites/default/files/office.jpg">')).toEqual([{url:'https://www.hill.co.uk/sites/default/files/office.jpg',position:0,altText:undefined}]);});
});

it('reports an unsupported smaller-home microsite as a coverage gap rather than empty inventory',()=>{expect(()=>discoverHomes('<h1>Current</h1><main>2, 3 and 4 bedroom homes. Visit the dedicated website.</main>',url)).toThrow('No supported current plot list');expect(discoverHomes('<h1>Current</h1><table>'+row(1,2)+'</table>',url).homes[0]?.bedrooms).toBe(2);});

it('retains a linked Hill home with unknown bedroom metadata for unrestricted collection',()=>{expect(discoverHomes('<h1>Test</h1><table>'+row(1,3).replace('>3</td>','></td>')+'</table>',url).homes[0]?.bedrooms).toBeNull();});
