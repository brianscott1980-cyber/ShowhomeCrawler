import type {SiteCard} from '../web/site-filters';
import type {GroupCardItem} from '../web/group-cards';
import type {DeveloperCard} from '../web/directory';
export function directoryFilterRows(kind:string,card:SiteCard|GroupCardItem|DeveloperCard):Record<string,unknown>[]{
 const base={kind,card_key:'slug' in card?card.slug:card.key};
 if('slug' in card)return card.locations.map(l=>({...base,developer:card.name,site:l.name,site_id:l.key,region:l.region,latitude:l.latitude,longitude:l.longitude,building_types:l.buildingTypes??[],areas:[l.region??'Unknown']}));
 if('developer' in card){const common={...base,developer:card.developer,site:card.name,site_id:card.key,region:card.region,latitude:card.latitude,longitude:card.longitude,areas:[card.region??card.country??'Unknown']};return card.properties.length?card.properties.map(p=>({...common,bedrooms:p.bedrooms,price:p.price,style:p.style})): [common];}
 const rows:Record<string,unknown>[]=(card.places??[]).map(p=>({...base,developer:p.developer,bedrooms:p.bedrooms,site:p.site,site_id:p.siteId,areas:p.locations,image_ids:p.imageIds??[]}));
 // Preserve image identities without a property relationship for unfiltered counts.
 const linked=new Set(rows.flatMap(r=>r.image_ids as string[]));
 const orphan=(card.interiorIds??[]).filter(id=>!linked.has(id));
 if(!rows.length||orphan.length)for(const developer of card.developers)rows.push({...base,developer,bedrooms:undefined,site:undefined,site_id:undefined,areas:[],image_ids:orphan});
 return rows;
}
