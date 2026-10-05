const key='showhome-navigation-sources';
type Sources=Record<string,string>;
export function rememberPageSource(storage:Pick<Storage,'getItem'|'setItem'>,source:string,destination:string){
 const sources=readSources(storage);
 sources[destination]=source;
 storage.setItem(key,JSON.stringify(sources));
}
function readSources(storage:Pick<Storage,'getItem'>):Sources{
 try {return JSON.parse(storage.getItem(key)??'{}') as Sources;}catch{return {};}
}
export function rememberedPageSource(storage:Pick<Storage,'getItem'>,destination:string,origin:string):string|null{
 const value=readSources(storage)[destination];
 if(typeof value!=='string')return null;
 try {const url=new URL(value,origin);return url.origin===origin?url.pathname+url.hash:null;}catch{return null;}
}

// Navigation intent lives only in this document: a fresh direct arrival starts clean.
let filterReturnPath:string|null=null;
export function markFilterNavigation(storage:Pick<Storage,'getItem'>,from:string,to:string,origin:string){
 incomingFilters=null;
 const source=rememberedPageSource(storage,from.split(/[?#]/)[0]!,origin);
 filterReturnPath=source?.split(/[?#]/)[0]===to.split(/[?#]/)[0]?to.split(/[?#]/)[0]!:null;
}
export function shouldRestorePageFilters(path:string){return filterReturnPath===path;}

let incomingFilters:{path:string;values:Record<string,string>}|null=null;
export function setIncomingPageFilters(path:string,values:Record<string,string>|null){
 incomingFilters=values?{path,values}:null;
}
export function incomingPageFilters(path:string):Record<string,string>{return incomingFilters?.path===path?incomingFilters.values:{};}
