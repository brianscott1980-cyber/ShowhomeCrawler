import {readFile,mkdir,open,unlink} from 'node:fs/promises';
import {resolve} from 'node:path';
import {parseArgs} from 'node:util';
import {load} from 'cheerio';
import {createHash} from 'node:crypto';
import {setTimeout as sleep} from 'node:timers/promises';
import {createDatabase} from '../database/postgres';
import {atomicFile} from '../crawler/atomic-file';
import {developmentContact} from '../web/development-contact';
import {extractDevelopmentCoordinates} from '../web/development-location-source';
import {mappedPlaces,areaSummary,distanceLabels,type Point,type LocalArea} from '../enrichment/local-area';
import {hbfAnnual,profileReview} from '../enrichment/builder-research';
const root=resolve('.showhome/enrichment'),headers={'User-Agent':'ShowhomeExplorer catalogue research (source-linked development information)'};
const digest=(v:string)=>createHash('sha256').update(v).digest('hex');
let offlineMap:any;
async function text(url:string,timeout=30000){const r=await fetch(url,{headers,signal:AbortSignal.timeout(timeout)});if(!r.ok)throw new Error(`HTTP ${r.status}`);if(!r.headers.get('content-type')?.includes('text/html'))throw new Error('Not an HTML development page');return r.text();}
async function researchBuilders(sql:ReturnType<typeof createDatabase>,inventory:any,audit:any){
 const seed=JSON.parse(await readFile('src/data/builder-ratings.json','utf8'));const reviewed=JSON.parse(await readFile('src/data/builder-reviews-research.json','utf8'));const source='https://www.hbf.co.uk/policy/campaigns-and-initiatives/css-star-awards/';
 let annual:any;try{const html=await text(source);await atomicFile(resolve(root,'hbf-source.html'),html);annual=hbfAnnual(html);}catch{audit.ratingErrors.push('HBF source unavailable; retained verified ratings');}
 const evidence:any[]=[];
 for(const b of inventory.builders){const known=seed.find((r:any)=>r.slug===b.slug),facts={...b.facts},checkedAt=new Date().toISOString();let hbf='not published',reviews='retained previous verified sources';
  const office={...(b.office??{})};try{const $=load(await text(b.website_url));const nodes:any[]=[];const visit=(v:any)=>{if(!v||typeof v!=='object')return;if(Array.isArray(v)){v.forEach(visit);return;}nodes.push(v);Object.values(v).forEach(visit);};$('script[type="application/ld+json"]').each((_,e)=>{try{visit(JSON.parse($(e).text()));}catch{}});const org=nodes.find(n=>/Organization|HomeAndConstructionBusiness/.test(String(n['@type']))&&n.address&&(!n.url||new URL(n.url,b.website_url).hostname===new URL(b.website_url).hostname));if(org){office.address??=[org.address.streetAddress,org.address.addressLocality,org.address.addressRegion,org.address.postalCode].filter(Boolean).join(', ');office.telephone??=org.telephone;office.email??=org.email;office.sourceUrl=b.website_url;office.checkedAt=checkedAt;}if(!office.address){const address=$('footer address').first().text().replace(/\s+/g,' ').trim();if(/\b[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}\b/i.test(address)){office.address=address;office.sourceUrl=b.website_url;office.checkedAt=checkedAt;}}}catch{}
  if(Object.keys(office).length)await sql`update showhome_web.builders set office=coalesce(office,'{}'::jsonb)||${sql.json(office)} where slug=${b.slug}`;
  const match=annual?.results.find((r:any)=>String(r.housebuilder_name).toLowerCase()===String(known?.hbf.awardName??b.name).toLowerCase());
  const stars=Number(match?.star_rating),score=Number(match?.composite_score);if(match&&stars>=1&&stars<=5&&match.composite_score!==null&&Number.isFinite(score)){
   facts.rating={stars,score,value:Math.round(score*2)/2,year:Number(String(annual.name).match(/20\d{2}/)?.[0]??String(annual.date).slice(0,4)),source,scope:known?.hbf.scope??undefined,checkedAt};hbf='verified';
   await sql`update public.builders set hbf_rating=${stars},hbf_composite_score=${score},hbf_year=${facts.rating.year},hbf_source_url=${source},hbf_checked_at=${checkedAt} where slug=${b.slug}`;
  }
  const profile=known?.trustpilot.url;let latest:any;
  if(profile)try{latest=profileReview(await text(profile),profile);if(!latest)throw new Error('Profile aggregate absent');reviews='verified';await sql`update public.builders set trustpilot_rating=${latest.rating},trustpilot_review_count=${latest.count},trustpilot_url=${profile},trustpilot_checked_at=${checkedAt} where slug=${b.slug}`;}catch{reviews='source unavailable; retained verified snapshot';}
  if(!latest){const snapshot=reviewed.find((r:any)=>r.slug===b.slug&&r.url===profile);if(snapshot&&snapshot.rating>=0&&snapshot.rating<=5&&Number.isInteger(snapshot.count)&&snapshot.count>0){latest=snapshot;reviews='web-retrieved verified profile (may be cached)';await sql`update public.builders set trustpilot_rating=${latest.rating},trustpilot_review_count=${latest.count},trustpilot_url=${profile},trustpilot_checked_at=${snapshot.checkedAt} where slug=${b.slug} and (trustpilot_checked_at is null or trustpilot_checked_at<=${snapshot.checkedAt}::timestamptz)`;}}
  const sources=[...(facts.reviews?.sources??[])];
  const ledger=await sql`select s.provider,s.rating,s.review_count,s.source_url,s.scope,s.checked_at from public.builder_review_sources s join public.builders b on b.id=s.builder_id where b.slug=${b.slug} and s.status='verified' and s.rating is not null and s.review_count>0`;
  for(const s of ledger)if(!sources.some((existing:any)=>existing.url===s.source_url))sources.push({name:`${s.provider==='trustpilot'?'Trustpilot':'Google'} (${s.scope??'builder'})`,rating:Number(s.rating),count:Number(s.review_count),url:s.source_url,checkedAt:new Date(s.checked_at).toISOString()});
  if(latest){const checked=latest.checkedAt??checkedAt,index=sources.findIndex((s:any)=>s.url===profile||s.name.toLowerCase().includes('trustpilot'));const entry={name:`Trustpilot · ${latest.name}${known?.trustpilot.scope?` (${known.trustpilot.scope})`:''}`,rating:latest.rating,count:latest.count,url:profile,checkedAt:checked};if(index>=0){if(Date.parse(sources[index].checkedAt)<=Date.parse(checked))sources[index]=entry;}else sources.push(entry);
   await sql`insert into public.builder_review_sources(builder_id,provider,profile_key,profile_name,rating,average_rating,review_count,source_url,scope,status,checked_at,evidence) select id,'trustpilot',${new URL(profile).pathname},${latest.name},${latest.rating},${latest.rating},${latest.count},${profile},${known?.trustpilot.scope??'builder'},'verified',${checked},${sql.json({method:latest.method??'Published profile structured aggregateRating',url:profile})} from public.builders where slug=${b.slug} on conflict(builder_id,provider,profile_key) do update set rating=excluded.rating,average_rating=excluded.average_rating,review_count=excluded.review_count,checked_at=excluded.checked_at,evidence=excluded.evidence where public.builder_review_sources.checked_at<=excluded.checked_at`;
  }
  const valid=sources.filter((s:any)=>Number.isFinite(s.rating)&&s.count>0);if(valid.length){const count=valid.reduce((n:number,s:any)=>n+s.count,0);facts.reviews={average:valid.reduce((n:number,s:any)=>n+s.rating*s.count,0)/count,count,sources:valid};}
  await sql`update showhome_web.builders set facts=facts||${sql.json({...(facts.rating?{rating:facts.rating}:{}),...(facts.reviews?{reviews:facts.reviews}:{})})} where slug=${b.slug}`;
  await sql`update showhome_web.directory_cards set payload=jsonb_set(jsonb_set(payload,'{rating}',coalesce(${sql.json(facts.rating??null)}::jsonb,'null'::jsonb),true),'{reviews}',coalesce(${sql.json(facts.reviews??null)}::jsonb,'null'::jsonb),true) where kind='builders' and builder_slug=${b.slug}`;
  evidence.push({slug:b.slug,name:b.name,hbf,reviews,rating:facts.rating??null,customerReviews:facts.reviews??null,office,checkedAt});console.log(`Builder researched: ${b.slug}; HBF ${hbf}; reviews ${reviews}`);await sleep(500);
 }
 await atomicFile(resolve(root,'builders.json'),JSON.stringify(evidence,null,2));audit.buildersResearched=evidence.length;
}
async function overpass(point:Point){
 if(offlineMap)return {...offlineMap,elements:offlineMap.elements.filter((e:any)=>{const p=e.center??e;return Math.abs(p.lat-point.latitude)<0.5&&Math.abs(p.lon-point.longitude)<0.8;})};
 // One cached request per coordinate: only named facilities, no image or NAS reads.
 const key=digest(`${point.latitude.toFixed(5)},${point.longitude.toFixed(5)}`),file=resolve(root,'map-cache',key+'.json');
 const cached=await readFile(file,'utf8').then(JSON.parse).catch(()=>undefined);if(cached&&Date.now()-Date.parse(cached.checkedAt)<30*86400000)return cached;
 const p=`${point.latitude},${point.longitude}`,query=`[out:json][timeout:40];(nwr[railway=station](around:32000,${p});node[highway=motorway_junction](around:32000,${p});nwr[shop=mall][name](around:24000,${p});nwr[landuse=retail][name](around:24000,${p});nwr[shop=supermarket][name](around:5000,${p});nwr[amenity~"^(school|doctors|hospital|bus_station)$"][name](around:5000,${p});nwr[leisure=park][name](around:5000,${p}););out center tags;`;
 const r=await fetch(process.env.AREA_MAP_ENDPOINT??'https://overpass.private.coffee/api/interpreter',{method:'POST',headers:{...headers,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({data:query}),signal:AbortSignal.timeout(55000)});if(!r.ok){await atomicFile(resolve(root,'last-map-error.txt'),await r.text());throw new Error(`Map source HTTP ${r.status}`);}const data=await r.json();if(!Array.isArray(data.elements)||data.remark)throw new Error('Map query incomplete');
 const saved={checkedAt:new Date().toISOString(),dataAsOf:data.osm3s?.timestamp_osm_base,elements:data.elements};await atomicFile(file,JSON.stringify(saved));return saved;
}
async function aiSelection(places:ReturnType<typeof mappedPlaces>){
 const nearby:any[]=places.filter(p=>p.miles<=1).slice(0,30);if(!nearby.length)nearby.push({id:'coverage:none',fact:'The current map extract identifies no named amenities within one mile. This does not prove amenities are absent; coverage may be incomplete.'});
 // Share the resident model with the classifier; do not load a second GPU model.
 const model=process.env.AREA_SUMMARY_MODEL??'qwen3-vl:8b-instruct';const r=await fetch('http://127.0.0.1:11434/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(180000),body:JSON.stringify({model,stream:false,keep_alive:'5m',format:{type:'object',properties:{selectedIds:{type:'array',items:{type:'string'},minItems:1,maxItems:4}},required:['selectedIds'],additionalProperties:false},messages:[{role:'user',content:'Select up to four of these verified amenities to describe the immediate one-mile area around a housing development. Prefer a useful mix of parks, shops, schools and transport. Return selectedIds copied exactly from the input. No other claims. /no_think\n'+JSON.stringify(nearby)}],options:{temperature:0,num_ctx:4096,num_predict:256}})});if(!r.ok)throw new Error(`AI HTTP ${r.status}`);const response=await r.json(),parsed=JSON.parse(response.message.content);if(!Array.isArray(parsed.selectedIds)||!parsed.selectedIds.length||parsed.selectedIds.some((id:string)=>!nearby.some(p=>p.id===id)))throw new Error('AI returned ungrounded fact IDs');return {ids:[...new Set<string>(parsed.selectedIds)],model};
}
async function main(){
 const {values}=parseArgs({options:{limit:{type:'string'},builder:{type:'string'},'skip-builders':{type:'boolean'},'contacts-only':{type:'boolean'},'map-file':{type:'string'},retry:{type:'boolean'}}});await mkdir(resolve(root,'map-cache'),{recursive:true});await mkdir(resolve(root,'pages'),{recursive:true});
 const previous=await readFile(resolve(root,'progress.json'),'utf8').then(JSON.parse).catch(()=>({developments:[]}));await mkdir(resolve(root,'runs'),{recursive:true});if(previous.startedAt)await atomicFile(resolve(root,'runs',previous.startedAt.replace(/[:.]/g,'-')+'.json'),JSON.stringify(previous,null,2));
 offlineMap=await readFile(resolve(values['map-file']??resolve(root,'uk-map.json')),'utf8').then(JSON.parse).catch(()=>undefined);
 if(!offlineMap&&!values['contacts-only'])throw new Error('Build the verified offline map with build-area-map.ts first; use --contacts-only for the independent contact scan.');
 const lock=resolve(root,'worker.lock');let handle;try{handle=await open(lock,'wx');await handle.writeFile(String(process.pid));}catch{const pid=Number(await readFile(lock,'utf8'));let active=false;try{process.kill(pid,0);active=true;}catch{}if(active)throw new Error('Enrichment worker already running; inspect .showhome/enrichment/worker.lock');await unlink(lock);handle=await open(lock,'wx');await handle.writeFile(String(process.pid));}
 const sql=createDatabase(),audit:any={startedAt:new Date().toISOString(),status:'running',buildersResearched:0,completed:0,needsLocation:0,unavailable:0,failed:0,current:null,ratingErrors:[],developments:[]};
 const save=()=>atomicFile(resolve(root,'progress.json'),JSON.stringify({...audit,updatedAt:new Date().toISOString()},null,2));
 try{
  const inventory={builders:await sql`select slug,name,website_url,facts,office from showhome_web.builders order by slug`,developments:await sql`select * from showhome_web.developments order by builder_slug,source_url`,buildings:await sql`select key,builder_slug,name from showhome_web.buildings order by builder_slug,name`};
  await atomicFile(resolve(root,'inventory.json'),JSON.stringify(inventory,null,2));audit.inventory={builders:inventory.builders.length,developments:inventory.developments.length,buildingTypes:inventory.buildings.length};await save();
  if(!values['skip-builders'])await researchBuilders(sql,inventory,audit);
  let targets=inventory.developments.filter(d=>!values.builder||d.builder_slug===values.builder);if(values.retry){const failed=new Set(previous.developments.filter((d:any)=>d.status==='failed').map((d:any)=>d.key));targets=targets.filter(d=>failed.has(d.key));}if(values.limit)targets=targets.slice(0,Number(values.limit));audit.total=targets.length;
  for(const d of targets){
   audit.current={builder:d.builder_slug,development:d.display_name??d.name,url:d.source_url};await save();let stage='source';
   const record:any={key:d.key,builder:d.builder_slug,name:d.display_name??d.name,url:d.source_url};
   try{
    const file=resolve(root,'pages',digest(d.source_url)+'.html');let html=await readFile(file,'utf8').catch(()=>undefined);if(!html){try{html=await text(d.source_url);await atomicFile(file,html);}catch(error){record.sourceError=(error as Error).message;html='';}}const $=load(html);const extracted=developmentContact(html);extracted.sourceUrl=d.source_url;extracted.checkedAt=new Date().toISOString();
    // Retain existing contact fields; fill the missing fields from this page only.
    const contact={...extracted,...d.contact};for(const field of ['telephone','email','address','openingHours'] as const)if(!(contact as any)[field]&&(extracted as any)[field])(contact as any)[field]=(extracted as any)[field];
    if(!contact.address){$('main address,[itemprop="address"]').not('footer address,header address').each((_,e)=>{const value=$(e).text().replace(/\s+/g,' ').trim();if(!contact.address&&/\b[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}\b/i.test(value))contact.address=value.slice(0,350);});}
    const extractedPoint=extractDevelopmentCoordinates(html,d.source_url);let point:Point|undefined,coordinateMethod='recorded-development';
    if(d.latitude!==null&&d.longitude!==null&&Number.isFinite(d.latitude)&&Number.isFinite(d.longitude)&&d.latitude>=49&&d.latitude<=61.2&&d.longitude>=-9&&d.longitude<=3)point={latitude:d.latitude,longitude:d.longitude};
    else if(extractedPoint.latitude!==undefined&&extractedPoint.longitude!==undefined){point={latitude:extractedPoint.latitude,longitude:extractedPoint.longitude};coordinateMethod='builder-map';}
    else if(d.postcode||extractedPoint.postcode){const postcode=d.postcode??extractedPoint.postcode;const r=await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(postcode)}`,{headers,signal:AbortSignal.timeout(15000)});const data=await r.json();if(data.result){point={latitude:data.result.latitude,longitude:data.result.longitude};coordinateMethod='postcode-centre';}}
    await sql`update showhome_web.developments set contact=${sql.json(contact)}||jsonb_strip_nulls(coalesce(contact,'{}'::jsonb)),latitude=coalesce(latitude,${point?.latitude??null}),longitude=coalesce(longitude,${point?.longitude??null}),postcode=coalesce(postcode,${extractedPoint.postcode??null}) where key=${d.key}`;
    record.contact={telephone:Boolean(contact.telephone),email:Boolean(contact.email),address:Boolean(contact.address)};
    if(values['contacts-only']){record.status=record.sourceError?'source_unavailable':'contacts_scanned';audit.completed++;}
    else if(!point){record.status='needs_location';audit.needsLocation++;}
    else if(d.crawl_metadata?.localArea?.status==='complete'){record.status='already_complete';audit.completed++;}
    else{
     stage='map';const data=await overpass(point),places=mappedPlaces(data.elements,point);stage='ai';const selection=await aiSelection(places),summary=areaSummary(places,selection.ids);
     const area:LocalArea={summary,radiusMiles:1,distanceMethod:'straight-line',coordinateMethod,...point,places:[...new Map([...places.filter(p=>p.miles<=1).slice(0,30),...distanceLabels(places)].map(p=>[p.id,p])).values()],sources:[{name:'Development website',url:d.source_url,checkedAt:contact.checkedAt??new Date().toISOString()},{name:'OpenStreetMap',url:`https://www.openstreetmap.org/?mlat=${point.latitude}&mlon=${point.longitude}#map=15/${point.latitude}/${point.longitude}`,checkedAt:data.checkedAt,dataAsOf:data.dataAsOf},...(data.source?[{name:'Geofabrik UK map extract',url:data.source,checkedAt:data.checkedAt,dataAsOf:data.dataAsOf}]:[])],generatedAt:new Date().toISOString(),model:selection.model,status:summary?'complete':'needs_review'};
     await sql`update showhome_web.developments set crawl_metadata=jsonb_set(coalesce(crawl_metadata,'{}'::jsonb),'{localArea}',${sql.json(area as any)},true) where key=${d.key}`;
     record.status=area.status;record.model=area.model;record.mappedAmenities=places.length;audit.completed++;await sleep(1500);
    }
   }catch(error){record.status='failed';record.stage=stage;record.error=(error as Error).message;if(/HTTP (404|410)|Not an HTML/.test(record.error)){record.status='source_unavailable';audit.unavailable++;}else audit.failed++;}
   audit.developments.push(record);console.log(JSON.stringify(record));await save();await sleep(1000);
  }
  await sql`delete from showhome_web.query_cache`;await sql`update showhome_web.publication_revision set revision=revision+1 where singleton=true`;
  audit.current=null;audit.status=audit.failed?'completed_with_failures':'completed';audit.finishedAt=new Date().toISOString();await save();
 }catch(error){audit.status='failed';audit.error=(error as Error).message;await save();throw error;}finally{await sql.end({timeout:5});await handle.close();await unlink(lock).catch(()=>{});}
}
main().catch(error=>{console.error('Enrichment:',(error as Error).message);process.exitCode=1;});
