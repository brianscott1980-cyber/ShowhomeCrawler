import type {MapGeoJSONFeature} from 'maplibre-gl';
import {BUILDER_ICON_ZOOM} from './builder-map-brand';

export interface FocusArea {
 left: number;
 top: number;
 right: number;
 bottom: number;
}

export function markerFitsViewport(point:{x:number;y:number},radius:number,size:{width:number;height:number},focusArea?:FocusArea){
 const minX=focusArea?focusArea.left:0;
 const minY=focusArea?focusArea.top:0;
 const maxX=focusArea?focusArea.right:size.width;
 const maxY=focusArea?focusArea.bottom:size.height;
 return point.x-radius>=minX&&point.y-radius>=minY&&point.x+radius<=maxX&&point.y+radius<=maxY;
}

/** Cluster members follow the visible cluster marker, rather than their hidden individual coordinates. */
export async function fullyVisibleSiteKeys(features:Pick<MapGeoJSONFeature,'geometry'|'properties'>[],project:(coordinates:[number,number])=>{x:number;y:number},size:{width:number;height:number},zoom:number,leaves:(id:number,count:number)=>Promise<{properties?:Record<string,unknown>|null}[]>,focusArea?:FocusArea){
 const keys=new Set<string>(),clusters=new Set<number>();
 await Promise.all(features.map(async feature=>{
  if(feature.geometry.type!=='Point')return;
  const properties=feature.properties;
  const count=Number(properties.point_count??0);
  // Include the white outline; cluster allowance also accommodates its highlighted outline.
  const radius=count?(count>=100?25:count>=20?21:17)+4:zoom>=BUILDER_ICON_ZOOM?16:9;
  if(!markerFitsViewport(project(feature.geometry.coordinates as [number,number]),radius,size,focusArea))return;
  if(count){
   const id=Number(properties.cluster_id);if(clusters.has(id))return;clusters.add(id);
   for(const leaf of await leaves(id,count))if(typeof leaf.properties?.key==='string')keys.add(leaf.properties.key);
  }else if(typeof properties.key==='string')keys.add(properties.key);
 }));
 return [...keys].sort();
}
