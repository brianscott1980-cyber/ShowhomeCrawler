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
