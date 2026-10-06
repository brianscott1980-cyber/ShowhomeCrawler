import type {Collection} from '../web/groups';
import {groupCollections,spaceName} from '../web/groups';
import {groupRoutes} from '../web/group-routes';
import {readLocationRows,type LocationRow} from '../web/location-geography';
import {overviewCollection} from '../web/overview-payload';
export async function builderOverviewProjection(collection:Collection){
 const locations=groupCollections([collection],'locations'),routes=groupRoutes('locations',locations);
 const urls=new Map(locations.map(g=>[g.developmentUrl,routes.get(g.key)!]));
 const points=(await readLocationRows(collection.slug)).filter(l=>urls.has(l.url)).map(l=>({...l,href:urls.get(l.url)!}));
 const roomGroups=groupCollections([collection],'interiors').filter(g=>!['Exterior','Uncategorised'].includes(g.name));
 const interiors=new Set(roomGroups.flatMap(g=>g.collections.flatMap(c=>c.report.images.filter(i=>i.categorisation?i.categorisation.isRoom:Boolean(i.verdict?.matches)&&spaceName(i,c.report.question)!=='Exterior').map(i=>i.id)))).size;
 const imageCount=collection.report.images.filter(i=>i.categorisation?i.categorisation.isRoom||i.categorisation.mainCategory==='Exterior':i.verdict?.matches??true).length;
 return {report:overviewCollection(collection).report,locations:points,counts:{Locations:locations.length,'Building types':groupCollections([collection],'buildings').length,'Room types':roomGroups.length},interiors,imageCount};
}
export type BuilderOverviewProjection=Awaited<ReturnType<typeof builderOverviewProjection>>;
