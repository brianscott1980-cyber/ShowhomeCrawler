/** A full or read-only database must not turn an optional cache miss into a page error. */
let warned=false;
export async function cacheWrite(write:()=>PromiseLike<unknown>):Promise<void>{
 try{await write();}catch(error){
  const code=error&&typeof error==='object'&&'code' in error?String(error.code):'';
  if(code!=='25006'&&code!=='53100')throw error;
  if(!warned){console.warn('Shared query cache is unavailable; serving catalogue data without caching.',code);warned=true;}
 }
}
