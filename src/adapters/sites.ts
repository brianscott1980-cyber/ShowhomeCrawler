import { createSiteParser } from './barratt/site-parser.js';
import * as taylor from './taylor-wimpey/site-parser.js';
import * as bellway from './bellway/site-parser.js';
import * as barratt from './barratt/site-parser.js';
import * as cala from './cala/site-parser.js';
export function builderSite(slug='bellway') {
 if(slug==='bellway')return {name:'Bellway',slug,websiteUrl:'https://www.bellway.co.uk',sitemap:'https://www.bellway.co.uk/developments-sitemap.xml',...bellway};
 if(slug==='cala')return {name:'Cala',slug,websiteUrl:'https://www.cala.co.uk',sitemap:'https://www.cala.co.uk/sitemap.xml',...cala};
 if(slug==='barratt')return {name:'Barratt',slug,websiteUrl:'https://www.barratthomes.co.uk',sitemap:'https://www.barratthomes.co.uk/sitemaps/sitemap-barratt-developments.xml',...barratt};
 if(slug==='taylor-wimpey')return {name:'Taylor Wimpey',slug,websiteUrl:'https://www.taylorwimpey.co.uk',sitemap:'https://www.taylorwimpey.co.uk/developments.xml',...taylor};
 if(slug==='david-wilson')return {name:'David Wilson',slug,websiteUrl:'https://www.dwh.co.uk',sitemap:'https://www.dwh.co.uk/sitemap/',...createSiteParser('https://www.dwh.co.uk')};
 throw new Error('Unsupported builder.');
}
