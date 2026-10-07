import type {ReportImage,ReportProperty} from '../reports/report';
export interface GalleryImage extends ReportImage {position?:number;imageUid?:string;slug:string;developer:string;uid:string;homes:(ReportProperty&{areas?:string[];buildingName?:string})[]}
export interface GalleryScope {kind:'buildings'|'interiors'|'favourites';href:string;furnishing?:string;fixedFilters?:Record<string,string>}
export interface GalleryRequest {imageOnly?:boolean;scope:GalleryScope;filters?:Record<string,string>;favourites?:string[];offset?:number;limit?:number;selectedUid?:string}
export interface GalleryPageData {pendingInitial?:boolean;images:GalleryImage[];total:number;nextOffset:number;hasMore:boolean;counts:Record<string,number>;facets:{furnishing?:string[];building?:string[];colour?:string[];tag?:string[];category:string[];room:string[];developer:string[];bedrooms:number[];location:string[];site:string[];development:[string,string][]};}
