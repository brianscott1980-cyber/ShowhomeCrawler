import * as bellway from './bellway/site-parser.js';
import * as cala from './cala/site-parser.js';
export function builderSite(slug='bellway') {
 if(slug==='bellway')return {name:'Bellway',slug,websiteUrl:'https://www.bellway.co.uk',sitemap:'https://www.bellway.co.uk/developments-sitemap.xml',...bellway};
 if(slug==='cala')return {name:'Cala',slug,websiteUrl:'https://www.cala.co.uk',sitemap:'https://www.cala.co.uk/sitemap.xml',...cala};
 throw new Error('Unsupported builder.');
}
