import {createReadStream,createWriteStream} from 'node:fs';
import {mkdir,readFile,stat,rename} from 'node:fs/promises';
import {pipeline} from 'node:stream/promises';
import {Readable,Writable} from 'node:stream';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {parseArgs} from 'node:util';
import {atomicFile} from '../crawler/atomic-file';
const parseOSM=createRequire(import.meta.url)('osm-pbf-parser');
const root=resolve('.showhome/enrichment');
function relevant(t:any){return Boolean((t.name||t.highway==='motorway_junction'&&t.ref)&&(t.railway==='station'||t.highway==='motorway_junction'||t.shop==='mall'||t.shop==='supermarket'||t.landuse==='retail'||t.leisure==='park'||['school','doctors','hospital','bus_station'].includes(t.amenity)));}
async function scan(file:string,visit:(e:any)=>void,phase:string){let records=0,last=Date.now();await pipeline(createReadStream(file),parseOSM(),new Writable({objectMode:true,write(batch:any[],_encoding,next){for(const e of batch)visit(e);records+=batch.length;if(Date.now()-last>15000){console.log(JSON.stringify({phase,records}));last=Date.now();}next();}}));}
async function main(){
 const {values}=parseArgs({options:{url:{type:'string'},output:{type:'string'}}});await mkdir(root,{recursive:true});
 const url=values.url??'https://download.geofabrik.de/europe/united-kingdom-latest.osm.pbf',file=resolve(root,new URL(url).pathname.split('/').at(-1)!),output=resolve(values.output??resolve(root,'uk-map.json'));
 const progress:any={status:'downloading',source:url,startedAt:new Date().toISOString()};const save=()=>atomicFile(resolve(root,'map-progress.json'),JSON.stringify(progress,null,2));await save();
 let metadata:any;const info=await fetch(url,{method:'HEAD'});if(!info.ok)throw new Error('Map extract HEAD HTTP '+info.status);metadata={lastModified:info.headers.get('last-modified'),size:Number(info.headers.get('content-length'))};
 if((await stat(file).catch(()=>undefined))?.size!==metadata.size){const partial=file+'.partial',offset=(await stat(partial).catch(()=>undefined))?.size??0;const r=await fetch(url,{headers:offset?{Range:`bytes=${offset}-`}:{},signal:AbortSignal.timeout(30*60*1000)});if(!r.ok||!r.body)throw new Error('Map download HTTP '+r.status);if(offset&&r.status!==206)throw new Error('Map source cannot resume existing partial; retain it for inspection');console.log('Downloading '+url);await pipeline(Readable.fromWeb(r.body as any),createWriteStream(partial,{flags:offset?'a':'w'}));if(metadata.size&&(await stat(partial)).size!==metadata.size)throw new Error('Map download size mismatch');await rename(partial,file);}
 const checksum=await(await fetch(url+'.md5')).text(),expected=checksum.match(/\b[a-f0-9]{32}\b/i)?.[0];if(!expected)throw new Error('Published map checksum unavailable');const hasher=createHash('md5');for await(const chunk of createReadStream(file))hasher.update(chunk);if(hasher.digest('hex')!==expected.toLowerCase())throw new Error('Map extract checksum mismatch');
 progress.status='indexing';await save();const nodes:any[]=[],ways=new Map<number,any>(),relations:any[]=[],memberWays=new Set<number>(),motorwayRefs=new Map<number,string>();
 await scan(file,e=>{if(e.type==='way'&&e.tags?.highway==='motorway'&&e.tags.ref)for(const id of e.refs??[])motorwayRefs.set(id,e.tags.ref);if(!relevant(e.tags??{}))return;if(e.type==='node')nodes.push(e);else if(e.type==='way')ways.set(e.id,e);else if(e.type==='relation'){relations.push(e);for(const m of e.members??[])if(m.type==='way')memberWays.add(m.id);}},'select-facilities');
 for(const e of nodes)if(e.tags.highway==='motorway_junction'&&motorwayRefs.has(e.id))e.tags.motorway_ref=motorwayRefs.get(e.id);
 // Relations are often retail centres or parks. Resolve their boundary ways as well.
 if(memberWays.size)await scan(file,e=>{if(e.type==='way'&&memberWays.has(e.id))ways.set(e.id,e);},'resolve-boundaries');
 const needed=new Set<number>();for(const e of ways.values())for(const id of e.refs??[])needed.add(id);const coordinates=new Map<number,{lat:number;lon:number}>();
 await scan(file,e=>{if(e.type==='node'&&needed.has(e.id))coordinates.set(e.id,{lat:e.lat,lon:e.lon});},'resolve-coordinates');
 const centre=(refs:number[])=>{const points=refs.map(id=>coordinates.get(id)).filter((p):p is {lat:number;lon:number}=>Boolean(p));return points.length?{lat:(Math.min(...points.map(p=>p.lat))+Math.max(...points.map(p=>p.lat)))/2,lon:(Math.min(...points.map(p=>p.lon))+Math.max(...points.map(p=>p.lon)))/2}:undefined;};
 const elements=[...nodes.map(e=>({type:e.type,id:e.id,lat:e.lat,lon:e.lon,tags:e.tags})),...[...ways.values()].filter(e=>relevant(e.tags??{})).map(e=>({type:e.type,id:e.id,center:centre(e.refs??[]),tags:e.tags})),...relations.map(e=>({type:e.type,id:e.id,tags:e.tags,center:centre((e.members??[]).flatMap((m:any)=>m.type==='way'?ways.get(m.id)?.refs??[]:m.type==='node'?[m.id]:[]))}))].filter(e=>e.type==='node'||'center' in e&&e.center);
 const result={checkedAt:new Date().toISOString(),dataAsOf:metadata.lastModified,source:url,checksum:expected,elements};await atomicFile(output,JSON.stringify(result));progress.status='completed';progress.finishedAt=new Date().toISOString();progress.facilities=elements.length;progress.output=output;await save();console.log(JSON.stringify(progress));
}
main().catch(async e=>{console.error((e as Error).message);await atomicFile(resolve(root,'map-progress.json'),JSON.stringify({status:'failed',error:(e as Error).message,checkedAt:new Date().toISOString()},null,2)).catch(()=>{});process.exitCode=1;});
