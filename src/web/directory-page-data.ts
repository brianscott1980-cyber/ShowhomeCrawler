import type {SiteCard} from './site-filters';
export type DirectoryKind='builders'|'locations'|'buildings'|'interiors';
export interface DirectoryRequest {kind:DirectoryKind;filters?:Record<string,string>;point?:{latitude:number;longitude:number}|null;offset?:number;limit?:number;keys?:string[];selectedKey?:string}
export interface DirectoryPageData<T=any> {pendingInitial?:boolean;cards:T[];total:number;nextOffset:number;hasMore:boolean;facets:Record<string,(string|number)[]>;counts:Record<string,number>;mapCards?:SiteCard[]}
