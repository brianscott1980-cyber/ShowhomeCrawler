import {createPublicGalleryParser} from '../shared/public-gallery-parser.js';
const parser=createPublicGalleryParser({origin:'https://banconhomes.com',developmentPattern:/^\/development\/[^/]+\/?$/,homePattern:/^\/property\/[^/]+\/?$/,mediaPattern:/^\/app\/uploads\//,headingSelector:'title',gallerySelector:'#content'});
export const {developmentUrls,discoverHomes,galleryImages,enrichPage}=parser;
