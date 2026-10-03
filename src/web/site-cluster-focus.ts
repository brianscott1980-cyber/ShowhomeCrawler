import type {GeoJSONSource,MapGeoJSONFeature} from 'maplibre-gl';
type ClusterSource=Pick<GeoJSONSource,'getClusterLeaves'|'getClusterChildren'|'getClusterExpansionZoom'>;
/** Follow the selected site's branch until it is a leaf, avoiding a zoom that leaves it in a smaller cluster. */
export async function siteExpansionZoom(source:ClusterSource,features:Pick<MapGeoJSONFeature,'properties'>[],key:string,currentZoom:number){
 const seen=new Set<number>();
 async function contains(id:number,count:number){return (await source.getClusterLeaves(id,count,0)).some(leaf=>leaf.properties?.key===key);}
 for(const feature of features){
  const id=Number(feature.properties.cluster_id),count=Number(feature.properties.point_count);
  if(seen.has(id))continue;seen.add(id);
  if(!await contains(id,count))continue;
  let cluster=id,zoom=currentZoom;
  const branch=new Set<number>();
  while(!branch.has(cluster)){
   branch.add(cluster);
   zoom=Math.max(zoom,await source.getClusterExpansionZoom(cluster));
   const children=await source.getClusterChildren(cluster);
   if(children.some(child=>child.properties?.key===key))return zoom;
   let next:number|undefined;
   for(const child of children){
    if(!child.properties?.point_count)continue;
    const childId=Number(child.properties.cluster_id);
    if(await contains(childId,Number(child.properties.point_count))){next=childId;break;}
   }
   if(next===undefined)return zoom;
   cluster=next;
  }
  return zoom;
 }
 return undefined;
}
