/** Dispatch in queue order, keeping a bounded number of requests in flight. */
export async function orderedBatchPool<T>(items:readonly T[],concurrency:number,run:(item:T,index:number)=>Promise<void>,stopped:()=>boolean=()=>false){
 if(!Number.isInteger(concurrency)||concurrency<1)throw new Error('Batch concurrency must be a positive integer.');
 let next=0,failed=false;
 const worker=async()=>{
  while(next<items.length&&!failed&&!stopped()){
   const index=next++;
   try{await run(items[index]!,index);}catch(error){failed=true;throw error;}
  }
 };
 // Drain active requests before allowing the caller to release its stream lock.
 const results=await Promise.allSettled(Array.from({length:Math.min(concurrency,items.length)},worker));
 const failure=results.find((result):result is PromiseRejectedResult=>result.status==='rejected');
 if(failure)throw failure.reason;
}
