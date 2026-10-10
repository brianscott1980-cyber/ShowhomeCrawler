'use client';
import {useEffect,useState} from 'react';
import {authClient} from '../auth/browser';
import type {PipelinePhase,PipelineSummary} from '../reports/pipeline-summary';
import styles from './classifications.module.css';
type Summary=PipelineSummary&{source:'snapshot'|'live'|'local'};
const number=(n:number)=>n.toLocaleString('en-GB');
function timestamp(value:string){return Number.isFinite(Date.parse(value))?new Date(value).toLocaleString('en-GB',{timeZone:'Europe/London',dateStyle:'medium',timeStyle:'short'}):'Not recorded';}
const labels:Record<string,string>={recorded:'Existing catalogue',running:'Running',completed:'Completed',stopped:'Stopped',failed:'Needs attention',pending:'Pending','needs attention':'Needs attention','waiting for images':'Waiting for images','no galleries recorded':'No galleries recorded'};
const statusLabel=(s:string)=>labels[s]??s;
function Progress({summary}:{summary?:Summary}){
 if(!summary)return <span className={styles.muted}>Not recorded</span>;
 const {completed,total,failed}=summary.totals;
 return <div className={styles.progress}><strong>{number(completed)} / {number(total)}</strong><progress aria-label={`${summary.builderName} ${summary.phase} progress`} value={completed} max={total||1}/><span>{statusLabel(summary.status)}{failed?` · ${number(failed)} failures`:''}</span></div>;
}
function RecentProgress({summary}:{summary:Summary}){
 const stats=summary.statistics,unit=summary.phase==='crawl'?'galleries':'images';
 const eta=stats?.eta?new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',weekday:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(stats.eta)):stats?.remaining===0?'Complete':'Estimating';
 return <dl className={styles.metrics}>
  <div><dt>Processing rate</dt><dd>{stats?.perHour?number(Math.round(stats.perHour)):'Estimating'}</dd><span>{unit} per hour ? last hour</span></div>
  <div className={styles.etaMetric}><dt>Estimated finish</dt><dd>{eta}</dd><span>Current builder ? UK time</span></div>
  <div><dt>Remaining</dt><dd>{number(stats?.remaining??summary.totals.pending+summary.totals.failed)}</dd><span>{unit} to process</span></div>
  <div><dt>Last 24 hours</dt><dd>{stats?number(stats.completed24h):'Not recorded'}</dd><span>{unit} completed</span></div>
 </dl>;
}
function Activity({phase,summaries}:{phase:PipelinePhase;summaries:Summary[]}){
 const records=summaries.filter(s=>s.phase===phase);
 const running=records.flatMap<Summary&{workerId:string;workerModel:string;workerStatus:string}>(s=>phase==='classification'&&s.workers?s.workers.map(w=>({...s,status:w.status==='running'?'running':'stopped',workerStatus:w.status,updatedAt:w.updatedAt,currentDevelopments:w.currentDevelopments,statistics:w.statistics,workerId:w.id,workerModel:w.model})):(s.status==='running'?[{...s,workerId:phase,workerModel:'',workerStatus:s.status}]:[]));
 const tracked=records.filter(s=>s.statistics),completed24h=tracked.reduce((sum,s)=>sum+s.statistics!.completed24h,0),images24h=tracked.reduce((sum,s)=>sum+s.statistics!.images24h,0);
 const latest=[...records].sort((a,b)=>Date.parse(b.updatedAt)-Date.parse(a.updatedAt))[0];
 const totals=records.reduce((t,s)=>({completed:t.completed+s.totals.completed,total:t.total+s.totals.total,failed:t.failed+s.totals.failed,pending:t.pending+s.totals.pending}),{completed:0,total:0,failed:0,pending:0});
 return <section className={styles.activity}>
  <div className={styles.cardHeading}><h2>{phase==='crawl'?'Image crawling':'Image classifications'}</h2><span className={running.length?styles.running:styles.badge}>{running.length?'Running':'No active run reported'}</span></div>
  <div className={styles.overallHeading}><p className={styles.bigNumber}>{phase==='crawl'?number(records.reduce((sum,s)=>sum+s.totals.images,0)):number(totals.completed)}<span>{phase==='crawl'?'images collected':`of ${number(totals.total)} images classified`}</span></p><span className={styles.percentage}>{totals.total?Math.round(totals.completed/totals.total*100):0}%</span></div>
  <progress value={totals.completed} max={totals.total||1} aria-label={`${phase} overall progress`}/>
  {phase==='crawl'&&<p className={styles.muted}>{number(totals.completed)} / {number(totals.total)} galleries captured</p>}
  <dl className={styles.overallStats}><div><dt>Pending</dt><dd>{number(totals.pending)}</dd></div><div><dt>Failures</dt><dd>{number(totals.failed)}</dd></div><div><dt>Last 24 hours</dt><dd>{tracked.length?number(phase==='crawl'?images24h:completed24h):'Not recorded'}</dd></div></dl>
  {running.length?<div className={phase==='classification'?styles.currentGrid:undefined}>{running.map(s=><div className={styles.current} key={s.builder+':'+s.workerId}>
   <div className={styles.currentHeading}><div><span className={styles.metricLabel}>CURRENT BUILDER</span><h3>{s.builderName}</h3>{s.workerModel&&<p className={styles.modelName}>{s.workerModel}</p>}</div><span className={s.status==='running'?styles.running:styles.badge}>{s.status==='running'?'Processing':statusLabel(s.workerStatus)}</span></div>
   {phase==='crawl'&&<div><p className={styles.developmentName}>{s.stage?.label??(s.currentDevelopments.length?'Crawling image galleries':'Checking saved images and preparing galleries')}</p>{s.stage?.total!==undefined&&<><p className={styles.muted}>{number(s.stage.completed??0)} / {number(s.stage.total)} {s.stage.unit??'items'} checked</p><progress value={s.stage.completed??0} max={s.stage.total||1} aria-label={s.stage.label}/></>}</div>}
   {s.currentDevelopments.length>0?<p className={styles.developmentName}>{s.currentDevelopments.join(' · ')}</p>:phase==='classification'?<p className={styles.developmentName}>Preparing or waiting for images</p>:null}
   <RecentProgress summary={s}/>
   <small className={styles.updateStamp}>Updated {timestamp(s.updatedAt)}{Date.now()-Date.parse(s.updatedAt)>120000?' ? Update overdue; check the worker':''}</small>
  </div>)}</div>:<p className={styles.idle}>Latest recorded update: {latest?`${latest.builderName} ? ${timestamp(latest.updatedAt)}`:'Not recorded'}</p>}
 </section>;
}
export function Classifications({localAccess=false}:{localAccess?:boolean}={}){
 const [selected,setSelected]=useState(''),[data,setData]=useState<{commit:string;liveAvailable:boolean;localMode?:boolean;summaries:Summary[]}|null>(null),[error,setError]=useState('');
 useEffect(()=>{let alive=true,busy=false;async function refresh(){if(busy)return;busy=true;try{let headers:Record<string,string>={};if(!localAccess){const client=await authClient();const {data:{session}}=await client.auth.getSession();if(!session){if(alive){setData(null);setError('Sign in with your owner account to view progress.');}return;}headers={Authorization:'Bearer '+session.access_token};}const response=await fetch('/api/classifications',{headers,cache:'no-store'});if(!response.ok){if(alive)setData(null);throw new Error(response.status===403?'Access denied.':'Unable to load progress.');}const result=await response.json();if(alive){setData(result);setError('');}}catch(e){if(alive)setError(e instanceof Error?e.message:'Unable to load progress.');}finally{busy=false;}}void refresh();const timer=setInterval(()=>void refresh(),15000);return()=>{alive=false;clearInterval(timer);};},[localAccess]);
 const summaries=data?.summaries??[];
 const builders=[...new Map(summaries.map(s=>[s.builder,s.builderName])).entries()].sort((a,b)=>a[1].localeCompare(b[1]));
 const lookup=(builder:string,phase:PipelinePhase)=>summaries.find(s=>s.builder===builder&&s.phase===phase);
 const crawl=lookup(selected,'crawl'),classification=lookup(selected,'classification');
 const developments=[...new Map([...(crawl?.developments??[]),...(classification?.developments??[])].map(d=>[d.url,d.name])).entries()];
 return <main className={styles.report}><header className={styles.heading}><div><p className={styles.eyebrow}>PROCESSING SUMMARY</p><h1>Crawling & classifications</h1></div><span className={styles.badge}>Refreshes every 15 seconds</span></header>{error&&<p role="alert">{error}</p>}{!data&&!error&&<p>Loading progress…</p>}{data&&<><div className={styles.activities}><Activity phase="crawl" summaries={summaries}/><Activity phase="classification" summaries={summaries}/></div><section className={styles.section}><div className={styles.cardHeading}><h2>Builders</h2><span>{builders.length} recorded</span></div><div className={styles.tableWrap}><table><thead><tr><th>Builder</th><th>Developments</th><th>Images collected</th><th>Crawling galleries</th><th>Classified images</th></tr></thead><tbody>{builders.map(([slug,name])=>{const c=lookup(slug,'crawl'),i=lookup(slug,'classification');return <tr key={slug} className={selected===slug?styles.selected:undefined}><th><button className={styles.builderButton} onClick={()=>setSelected(slug)} aria-pressed={selected===slug}>{name}</button></th><td>{number(c?.totals.developments??i?.totals.developments??0)}</td><td>{number(c?.totals.images??i?.totals.images??0)}</td><td><Progress summary={c}/></td><td><Progress summary={i}/></td></tr>;})}</tbody></table></div></section><section className={styles.section}><div className={styles.cardHeading}><h2>Development progress</h2><select aria-label="Builder for development progress" value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Choose a builder</option>{builders.map(([slug,name])=><option key={slug} value={slug}>{name}</option>)}</select></div>{selected?<><p className={styles.muted}>Crawling: {crawl?timestamp(crawl.updatedAt):'Not recorded'} · Classification: {classification?timestamp(classification.updatedAt):'Not recorded'}</p><div className={styles.tableWrap}><table><thead><tr><th>Development</th><th>Images collected</th><th>Crawling galleries</th><th>Classified images</th></tr></thead><tbody>{developments.map(([url,name])=>{const c=crawl?.developments.find(d=>d.url===url),i=classification?.developments.find(d=>d.url===url);return <tr key={url}><th>{name}</th><td>{number(c?.images??i?.images??0)}</td><td>{c?<><strong>{number(c.completed)} / {number(c.total)}</strong><small>{statusLabel(c.status)}{c.failed?` · ${number(c.failed)} failures`:''}</small></>:'Not recorded'}</td><td>{i?<><strong>{number(i.completed)} / {number(i.total)}</strong><small>{statusLabel(i.status)}{i.failed?` · ${number(i.failed)} failures`:''}</small></>:'Not recorded'}</td></tr>;})}</tbody></table></div>{classification&&<details className={styles.modelDetails}><summary>Classification methods & coverage</summary><p>{number(classification.totals.structuredImages)} images have the new surface and furnishing colour attributes.</p>{classification.models.map(m=><p key={m.name}>{m.name}: {number(m.count)}</p>)}</details>}</>:<p>Select a builder above to see its developments.</p>}</section></>}</main>;
}
