import {matchesSelection,matchesAnySelection} from './filter-selection';
export interface BuildingPlace {site:string;locations:string[];developer?:string;bedrooms?:number}
export function matchesBuildingPlace(places:BuildingPlace[],site:string,location:string){return places.some(place=>matchesSelection(site,place.site)&&matchesAnySelection(location,place.locations));}
