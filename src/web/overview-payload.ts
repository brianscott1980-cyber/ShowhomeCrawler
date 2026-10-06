import type {Collection} from './groups';
export function overviewCollection(c:Collection):Collection{

  const candidates=c.report.images.filter(i=>i.categorisation?i.categorisation.isRoom||i.categorisation.mainCategory==='Exterior':!i.verdict||i.verdict.matches);
  const chosen=new Map<string,typeof candidates[number]>();
  for(const image of candidates){if(chosen.size>=24)break;const category=image.categorisation?.mainCategory??image.verdict?.roomType??'Uncategorised';if(![...chosen.values()].some(i=>(i.categorisation?.mainCategory??i.verdict?.roomType??'Uncategorised')===category))chosen.set(image.id,image);}
  for(const image of candidates){if(chosen.size>=24)break;chosen.set(image.id,image);}
  const ids=new Set(chosen.keys());
  return {...c,report:{...c.report,developments:[],errors:[],metrics:{},images:[...chosen.values()],properties:c.report.properties.filter(p=>p.imageIds.some(id=>ids.has(id))).map(p=>({...p,plots:[],imageIds:p.imageIds.filter(id=>ids.has(id))}))}};

}
