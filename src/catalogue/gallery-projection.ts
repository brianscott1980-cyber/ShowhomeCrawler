import {isCategorisedImage} from '../web/image-classification';
import type {Collection} from '../web/groups';
import {spaceName} from '../web/groups';
import {isRoomImage} from '../vision/room-classifier';
import {homeTypeName,isPlotName} from '../reports/home-display';
import {readWebsiteLocations} from '../database/website';
export async function galleryProjection(collection:Collection){
 const areas=new Map((await readWebsiteLocations(collection.slug)).map(d=>[d.url,Object.values(d.geography??{}).filter(Boolean)]));
 const homes=new Map<string,Collection['report']['properties']>();
 for(const home of collection.report.properties)for(const id of new Set(home.imageIds)){const list=homes.get(id)??[];list.push(home);homes.set(id,list);}
 return collection.report.images.map(image=>{
  const associated=homes.get(image.id)??[],cat=image.categorisation;
  const eligible=isCategorisedImage(image)&&!(cat&&!cat.isRoom&&cat.mainCategory!=='Exterior')&&!((!cat||cat.mainCategory==='Other')&&!isRoomImage(image));
  const search=[collection.name,image.verdict?.description,image.verdict?.reason,cat?.mainCategory,cat?.subCategory,...cat?.objects??[],...cat?.colours??[],...cat?.chairs??[],cat?.wallpaper,cat?.curtains,...cat?.decor??[],...cat?.wallpaperTags??[],...cat?.curtainTags??[],...cat?.fabricTags??[],...cat?.furnishingTags??[],cat?.hasTelevision?'television tv':'',cat?.hasComputer?'computer pc monitor desk laptop':'',...associated.map(h=>`${h.name} ${h.development}`)].join(' ').toLowerCase();
  return {building_names:[...new Set(associated.filter(h=>!isPlotName(homeTypeName(h.name))).map(h=>homeTypeName(h.name).toLowerCase()))],uid:`${collection.slug}:${image.id}`,builder_slug:collection.slug,image_id:image.id,builder_name:collection.name,category:spaceName(image,collection.report.question),room:cat?.subCategory??null,eligible,verdict_matches:Boolean(image.verdict?.matches),search_text:search,payload:{...image,slug:collection.slug,developer:collection.name,uid:`${collection.slug}:${image.id}`,homes:associated.map(({imageIds,...h})=>({...h,imageIds:[],buildingName:homeTypeName(h.name),areas:areas.get(h.developmentUrl)??[]}))}};
 });
}
