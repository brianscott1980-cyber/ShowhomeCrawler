/** Stable, image-capable Flash-Lite models only; no Pro, image-generation or aliases. */
export const SMALL_GEMINI_MODELS = ['gemini-3.1-flash-lite', 'gemini-2.5-flash-lite', 'gemini-3.5-flash-lite'] as const;
export function classificationModels(preferred?:string):string[] {
 return [...new Set([...(SMALL_GEMINI_MODELS.some(m=>m===preferred)?[preferred!]:[]),...SMALL_GEMINI_MODELS])];
}
export interface ModelState {model:string; status:'ready'|'quota_wait'|'unavailable'; retryAt?:string}
export class GeminiModelPool {
 private blocked=new Map<string,number>();
 private unavailable=new Set<string>();
 private cursor=0;
 currentModel:string;
 constructor(readonly models:readonly string[],private now:()=>number=Date.now){
  if(!models.length)throw new Error('At least one Gemini model required.');
  this.currentModel=models[0]!;
 }
 snapshot(){return {fallbackModels:[...this.models],modelStates:this.models.map(model=>({model,status:this.unavailable.has(model)?'unavailable':(this.blocked.get(model)??0)>this.now()?'quota_wait':'ready',...((this.blocked.get(model)??0)>this.now()?{retryAt:new Date(this.blocked.get(model)!).toISOString()}:{})})) as ModelState[]};}
 async run<T>(request:(model:string)=>Promise<T>,changed:()=>Promise<void>=async()=>{}):Promise<{model:string;value:T}>{
  for(let count=0;count<this.models.length;count++){
   const index=Array.from({length:this.models.length},(_,offset)=>(this.cursor+offset)%this.models.length).find(i=>!this.unavailable.has(this.models[i]!)&&(this.blocked.get(this.models[i]!)??0)<=this.now());
   if(index===undefined)break;
   const model=this.models[index]!;this.currentModel=model;await changed();
   try{return {model,value:await request(model)};}
   catch(error){
    const status=(error as {status?:number}).status;
    if(status!==429&&status!==404)throw error;
    if(status===404)this.unavailable.add(model);else this.blocked.set(model,this.now()+120000);
    this.cursor=(index+1)%this.models.length;await changed();
   }
  }
  if(this.unavailable.size===this.models.length)throw Object.assign(new Error('No configured Gemini model is available.'),{status:404});
  const retryAt=Math.min(...this.models.filter(m=>!this.unavailable.has(m)).map(m=>this.blocked.get(m)??this.now()));
  throw Object.assign(new Error('Gemini HTTP 429'),{status:429,retrySeconds:120,retryAt:new Date(retryAt).toISOString()});
 }
}
