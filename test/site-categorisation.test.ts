import {expect,it} from 'vitest';
import {hasSiteCategorisation} from '../src/vision/site-categorisation';
import type {ReportImage} from '../src/reports/report';
const image:ReportImage={id:'a',path:'images/a.jpg',sourceUrl:'https://builder.test/photo.jpg',categorisation:{categorisationSource:'website-html',mainCategory:'Kitchen',subCategory:'',isRoom:true,objects:[],colours:[],chairs:[],hasTelevision:false,hasComputer:false},siteCategoryEvidence:[{pageUrl:'https://builder.test/home',field:'alt',text:'Kitchen',categories:['Kitchen']}]};
it('accepts specific image labels without manufacturing a Gemini verdict',()=>{expect(hasSiteCategorisation(image)).toBe(true);expect(image.verdict).toBeUndefined();});
it('rejects unsupported, ambiguous or missing source evidence',()=>{
 expect(hasSiteCategorisation({...image,siteCategoryEvidence:[]})).toBe(false);
 expect(hasSiteCategorisation({...image,siteCategoryEvidence:[{...image.siteCategoryEvidence![0]!,categories:['Kitchen','Bedroom']}]})).toBe(false);
 expect(hasSiteCategorisation({...image,siteCategoryEvidence:[{...image.siteCategoryEvidence![0]!,field:'filename'}]})).toBe(false);
});
