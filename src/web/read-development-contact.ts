import {websiteDatabase} from '../database/website';
import type {DevelopmentContact} from './development-contact';
export async function readDevelopmentContact(url:string):Promise<DevelopmentContact>{
 const [row]=await websiteDatabase()`select contact from showhome_web.developments where source_url=${url} limit 1`;
 return row?.contact??{};
}
