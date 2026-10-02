export interface BuildingPlace {site:string;locations:string[]}
export function matchesBuildingPlace(places:BuildingPlace[],site:string,location:string){return places.some(place=>(!site||place.site===site)&&(!location||place.locations.includes(location)));}
