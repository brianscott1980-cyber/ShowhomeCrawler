import type {DeveloperCard,Point} from './directory';
import {matchesSelection} from './filter-selection';
import {milesBetween} from './site-filters';
export type BuilderFilters={region:string;location:string;radius:string};
export function matchingBuilderLocations(card:DeveloperCard,filters:BuilderFilters,point:Point|null){
 return card.locations.filter(location=>matchesSelection(filters.region,location.region??'Unknown')&&matchesSelection(filters.location,location.key??location.name)&&(!filters.radius||!point||(Number.isFinite(location.latitude)&&Number.isFinite(location.longitude)&&milesBetween(point,{latitude:location.latitude!,longitude:location.longitude!})<=Number(filters.radius))));
}
export function filterBuilders(cards:DeveloperCard[],filters:BuilderFilters,point:Point|null){return !filters.region&&!filters.location&&(!filters.radius||!point)?cards:cards.filter(card=>matchingBuilderLocations(card,filters,point).length>0);}
