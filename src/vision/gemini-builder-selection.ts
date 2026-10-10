/** Gemini clears the smallest queues; Ollama owns the final remaining builder. */
export function geminiBuilderSelection<T extends {slug:string;remaining:number;ollamaActive:boolean}>(builders:T[]):T[]{
 const pending=builders.filter(builder=>builder.remaining>0);
 if(pending.length<=1)return [];
 return pending.filter(builder=>!builder.ollamaActive).sort((a,b)=>a.remaining-b.remaining||a.slug.localeCompare(b.slug));
}
