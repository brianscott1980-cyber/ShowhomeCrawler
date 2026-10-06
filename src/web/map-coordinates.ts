import type {SiteCard} from './site-filters';
export interface MapBounds {west:number; east:number; south:number; north:number}
export interface MapCamera {lng:number;lat:number;zoom:number}
export function hasCoordinates(card:SiteCard):card is SiteCard & {latitude:number;longitude:number} {
 return Number.isFinite(card.latitude) && Number.isFinite(card.longitude) && Math.abs(card.latitude!)<=90 && Math.abs(card.longitude!)<=180;
}
export function inMapBounds(card:SiteCard, bounds:MapBounds) {
 if(!hasCoordinates(card))return false;
 const longitude=((card.longitude-bounds.west)%360+360)%360+bounds.west;
 return card.latitude>=bounds.south && card.latitude<=bounds.north && longitude<=bounds.east;
}
