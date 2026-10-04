import type {ReportImage} from '../reports/report.js';
const categories=new Set(['Bedroom','Bathroom','Living Room','Kitchen','Dining Room','Study & Home Office','Utility Room','Hallway','Toilet','Exterior','Floorplan']);
/** Website labels retain evidence and do not masquerade as visual Gemini verdicts. */
export function hasSiteCategorisation(image:ReportImage):boolean{
 const category=image.categorisation;
 return category?.categorisationSource==='website-html'&&categories.has(category.mainCategory)&&Boolean(image.siteCategoryEvidence?.length)&&image.siteCategoryEvidence!.every(e=>['alt','title','caption','data-caption','aria-label'].includes(e.field)&&e.text.trim()&&/^https?:\/\//.test(e.pageUrl)&&e.categories.length===1&&e.categories[0]===category.mainCategory);
}
