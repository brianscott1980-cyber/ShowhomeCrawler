import {expect,it} from 'vitest';
import {isCategorisedImage,isGraphicAsset} from '../src/web/image-classification';
import type {ReportImage} from '../src/reports/report';
it('rejects a graphic verdict even when a conflicting room category exists',()=>{
 const image={categorisation:{mainCategory:'Utility Room',isRoom:true},verdict:{matches:false,roomType:'graphic',reason:'This is a graphic icon/promotional asset rather than a property photo.'}} as ReportImage;
 expect(isGraphicAsset(image)).toBe(true);expect(isCategorisedImage(image)).toBe(false);
});
it('keeps photographs containing graphic patterns or promotional wording',()=>{
 const image={categorisation:{mainCategory:'Bedroom',isRoom:true},verdict:{matches:true,roomType:'Bedroom',description:'A bedroom with graphic patterned wallpaper and a promotional brochure on the table.'}} as ReportImage;
 expect(isGraphicAsset(image)).toBe(false);expect(isCategorisedImage(image)).toBe(true);
});
