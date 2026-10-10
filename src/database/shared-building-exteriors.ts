import {websiteDatabase} from './website';
/** Majority-sharing flags are refreshed when the publication revision changes. */
export async function sharedBuildingExteriorPaths():Promise<string[]>{
 const rows=await websiteDatabase()`select builder_slug,path from showhome_web.images where is_generic_exterior`;
 return rows.map(row=>`/api/assets/${row.builder_slug}/${String(row.path).split('/').map(encodeURIComponent).join('/')}`);
}
