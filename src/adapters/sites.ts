import * as robertson from './robertson/site-parser.js';
import * as persimmon from './persimmon/site-parser.js';
import * as springfield from './springfield/site-parser.js';
import * as avant from './avant/site-parser.js';
import * as miller from './miller/site-parser.js';
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
 if(slug==='miller-homes')return {name:'Miller Homes',slug,websiteUrl:'https://www.millerhomes.co.uk',sitemap:'https://www.millerhomes.co.uk/sitemaps.xml',...miller};
 if(slug==='avant')return {name:'Avant',slug,websiteUrl:'https://www.avanthomes.co.uk',sitemap:'https://www.avanthomes.co.uk/sitemap.xml',...avant};
 if(slug==='springfield')return {name:'Springfield',slug,websiteUrl:'https://www.springfield.co.uk',sitemap:'https://www.springfield.co.uk/homes-for-sale',...springfield};
 if(slug==='persimmon')return {name:'Persimmon',slug,websiteUrl:'https://www.persimmonhomes.com',sitemap:'https://www.persimmonhomes.com/sitemap',...persimmon};
 if(slug==='robertson-homes')return {name:'Robertson Homes',slug,websiteUrl:'https://www.robertsonhomes.co.uk',sitemap:'https://www.robertsonhomes.co.uk/location-sitemap.xml',...robertson};
 if(slug==='redrow')return {name:'Redrow',slug,websiteUrl:'https://www.redrow.co.uk',sitemap:'https://www.redrow.co.uk/sitemaps/sitemap-redrow-developments.xml',...redrow};
 if(slug==='berkeley-group')return {name:'The Berkeley Group',slug,websiteUrl:'https://www.berkeleygroup.co.uk',sitemap:'https://www.berkeleygroup.co.uk/sitemaps/sitemap-developments',...berkeley};
 if(slug==='crest-nicholson')return {name:'Crest Nicholson',slug,websiteUrl:'https://www.crestnicholson.com',sitemap:'https://www.crestnicholson.com/sitemap.xml',...crest};
 if(slug==='lynch-homes')return {name:'Lynch Homes',slug,websiteUrl:'https://www.lynchhomes.co.uk',sitemap:'https://www.lynchhomes.co.uk/sitemap_index.xml',...lynch};
 throw new Error('Unsupported builder.');
}
import * as redrow from './redrow/site-parser.js';
import * as berkeley from './berkeley/site-parser.js';
import * as crest from './crest/site-parser.js';

import * as lynch from './lynch/site-parser.js';
