import {load} from 'cheerio';
import {createPublicGalleryParser} from '../shared/public-gallery-parser.js';
const parser=createPublicGalleryParser({origin:'https://www.hayhilldevelopments.co.uk',developmentPattern:/^\/development\/[^/]+\/?$/,homePattern:/^\/developments\/[^/]+\/[^/]+\/?$/,mediaPattern:/^\/wp-content\/uploads\//});
export const {developmentUrls,galleryImages,enrichPage}=parser;
export function discoverHomes(html:string,url:string){const $=load(html);$('.att-plot-list-grid--listing').each((_,e)=>{const card=$(e);card.prepend($('<h3>').text(card.find('.plot-head span').eq(1).text().trim()));});return parser.discoverHomes($.html(),url);}
