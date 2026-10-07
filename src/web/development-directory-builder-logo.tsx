'use client';
import {useDirectoryBuilderSelection} from './directory-counts';
import {selectedValues} from './filter-selection';
import {builderBrand} from './builder-brand';
export function DevelopmentDirectoryBuilderLogo({logos}:{logos:{name:string;logo:string;background:string|null}[]}){
 const selected=selectedValues(useDirectoryBuilderSelection());
 const builder=selected.length===1?logos.find(builder=>builder.name===selected[0]):undefined;
 if(!builder)return null;
 return <img className="development-directory-builder-logo" src={builder.logo} alt={`${builder.name} logo`} width={120} height={72} style={{background:builderBrand(builder.name)?.logoBackground??builder.background??'#fff'}}/>;
}
