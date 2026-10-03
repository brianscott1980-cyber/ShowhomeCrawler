import {developers} from '../adapters/developers';
import {builderBrands} from './builder-brand';
export const BUILDER_ICON_ZOOM=15;
/** Small map monograms use the established builder palette and omit a leading “The”. */
export function builderMapBrand(nameOrSlug:string){
 const developer=developers.find(d=>d.slug===nameOrSlug||d.name===nameOrSlug);
 return developer?{slug:developer.slug,primary:builderBrands[developer.slug].primary,initial:developer.name.replace(/^The\s+/i,'').charAt(0).toUpperCase()}:{slug:'unknown',primary:'#193963',initial:nameOrSlug.charAt(0).toUpperCase()||'B'};
}
