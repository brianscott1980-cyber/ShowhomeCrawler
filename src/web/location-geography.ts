import {readWebsiteLocations} from '../database/website';
export interface LocationRow {name:string;url:string;town?:string|null;country?:string|null;postcode?:string;latitude?:number;longitude?:number;geography?:Record<string,string|null>}
export const readLocationRows=readWebsiteLocations;
