import {load} from 'cheerio';
import {createPublicGalleryParser} from '../shared/public-gallery-parser.js';
const parser=createPublicGalleryParser({origin:'https://ajcscotland.com',developmentPattern:/^\/developments\/[^/]+\/?$/,homePattern:/^\/developments\/[^/]+\/homes\/[^/]+\/?$/,mediaPattern:/^\/(?:assets|images\/made\/assets)\//,headingSelector:'title'});
export const {developmentUrls,galleryImages,enrichPage}=parser;
export function discoverHomes(html:string,url:string){const $=load(html);$('title').text($('title').text().split('|')[0]!.trim());return parser.discoverHomes($.html(),url);}
