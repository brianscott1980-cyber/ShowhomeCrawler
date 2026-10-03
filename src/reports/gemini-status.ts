import {readFile, writeFile, rename} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import type {RunReport} from './report.js';
import {isInferredAnalysis} from '../vision/analysis-provenance.js';
export interface GeminiState {state:'analysing'|'quota_wait'|'retrying'|'complete'; model:string; updatedAt:string; retryAt?:string; httpStatus?:number}
export async function saveGeminiState(folder:string, state:Omit<GeminiState,'updatedAt'>) {
 const path=`${folder}/gemini-state.json`, temporary=`${path}.${randomUUID()}.tmp`;
 await writeFile(temporary,JSON.stringify({...state,updatedAt:new Date().toISOString()}));
 await rename(temporary,path);
}
export async function readGeminiState(folder:string):Promise<GeminiState|undefined> {
 try {const value=JSON.parse(await readFile(`${folder}/gemini-state.json`,'utf8'));if(['analysing','quota_wait','retrying','complete'].includes(value.state)&&typeof value.model==='string'&&typeof value.updatedAt==='string')return value;}catch{}
}
const escape=(value:unknown)=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function geminiStatusPanel(report:RunReport) {
 const models=new Map<string,number>();
 for(const image of report.images)if(image.verdict&&!isInferredAnalysis(image.verdict)){const model=image.analysisModel??report.model;models.set(model,(models.get(model)??0)+1);}
 const state=report.geminiState;
 const label=state?{analysing:'Analysing images',quota_wait:'Waiting for Gemini quota',retrying:'Retrying request',complete:'Analysis worker finished'}[state.state]:(models.size?'Saved analysis results · live worker status unavailable':'Awaiting visual analysis · live worker status unavailable');
 return `<section aria-label="Gemini status" style="background:#15243a;color:white;padding:20px;margin:24px 0;font-size:14px;line-height:1.7"><strong>Gemini status: ${escape(label)}</strong><br>Selected model: ${escape(state?.model??report.model)}<br>Models used for saved visual analyses: ${escape([...models].map(([model,count])=>`${model} (${count} images)`).join(', ')||'None yet')}<br>Automatic fallback models: none. Retries use the selected model; explicitly requested cached analyses may use other models.<br><strong>Skipped / reused</strong><br>Completed galleries skipped on resume: ${escape(report.metrics.skippedCompletedGalleries??'Not recorded')} · Shared galleries skipped: ${escape(report.metrics.reusedGalleries??0)}<br>Duplicate image processing skipped: ${escape((report.metrics.reusedImages??0)+(report.metrics.reusedImageSources??0))}<br>Gemini requests avoided: ${escape(report.metrics.skippedExistingAnalyses===undefined&&report.metrics.analysisCacheHits===undefined?'Not recorded':(report.metrics.skippedExistingAnalyses??0)+(report.metrics.analysisCacheHits??0))} images (already analysed or cached)<br>Room categories are extracted from the visual descriptions.${state?`<br>Worker status updated: ${escape(state.updatedAt)}${state.httpStatus?` · HTTP ${escape(state.httpStatus)}`:''}${state.retryAt?` · Retry scheduled: ${escape(state.retryAt)}`:''}`:''}</section>`;
}
