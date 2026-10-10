export interface AreaPlace {id:string;kind:string;label:string;name:string;miles:number;url:string}
export interface LocalArea {summary:string;radiusMiles:1;distanceMethod:'straight-line';coordinateMethod:string;latitude:number;longitude:number;places:AreaPlace[];sources:{name:string;url:string;checkedAt:string;dataAsOf?:string}[];generatedAt:string;model:string;status:'complete'|'needs_review'}
export interface Point {latitude:number;longitude:number}
export function distanceMiles(a:Point,b:Point){const r=Math.PI/180,lat=(b.latitude-a.latitude)*r,lon=(b.longitude-a.longitude)*r;return 3958.7613*2*Math.asin(Math.min(1,Math.sqrt(Math.sin(lat/2)**2+Math.cos(a.latitude*r)*Math.cos(b.latitude*r)*Math.sin(lon/2)**2)));}
export function mappedPlaces(elements:any[],point:Point):AreaPlace[]{
 const result:AreaPlace[]=[];
 for(const e of elements){const t=e.tags??{},p=e.center??e;if(!Number.isFinite(p.lat)||!Number.isFinite(p.lon))continue;
  let kind='',label='';
  if(t.railway==='station'&&t.station!=='subway'&&t.station!=='light_rail'){kind='rail';label='Rail station';}
  else if(t.highway==='motorway_junction'&&t.motorway_ref){kind='motorway';label='Motorway junction';}
  else if(t.shop==='mall'||t.landuse==='retail'){kind='retail';label='Retail centre';}
  else if(t.shop==='supermarket'){kind='supermarket';label='Supermarket';}
  else if(t.amenity==='school'){kind='school';label='School';}
  else if(t.leisure==='park'){kind='park';label='Park';}
  else if(['doctors','hospital'].includes(t.amenity)){kind='health';label=t.amenity==='hospital'?'Hospital':'Medical practice';}
  else if(t.amenity==='bus_station'){kind='bus';label='Bus station';}
  if(!kind)continue;
  const name=kind==='motorway'?`${t.motorway_ref}${t.ref?` J${t.ref}`:''}${t.name?` · ${t.name}`:''}`:t.name;if(!name)continue;
  const miles=distanceMiles(point,{latitude:p.lat,longitude:p.lon});if(miles>20)continue;
  result.push({id:`${e.type}/${e.id}`,kind,label,name,miles:Number(miles.toFixed(3)),url:`https://www.openstreetmap.org/${e.type}/${e.id}`});
 }
 // Named objects sometimes have both a node and a polygon representation.
 const unique=new Map<string,AreaPlace>();for(const p of result.sort((a,b)=>a.miles-b.miles)){const key=p.kind+':'+p.name.toLowerCase();if(!unique.has(key))unique.set(key,p);}
 return [...unique.values()].sort((a,b)=>a.miles-b.miles);
}
export function distanceLabels(places:AreaPlace[]){return ['rail','motorway','retail','supermarket','school','park','health','bus'].map(kind=>places.find(p=>p.kind===kind)).filter((p):p is AreaPlace=>Boolean(p));}
/** AI selects documented facts; rendered prose cannot introduce unsupported claims. */
export function areaSummary(places:AreaPlace[],selectedIds:string[]){
 const nearby=places.filter(p=>p.miles<=1),selected=selectedIds.map(id=>nearby.find(p=>p.id===id)).filter((p):p is AreaPlace=>Boolean(p)).slice(0,4);
 if(!selected.length)return '';
 return `Within one mile of the development, mapped amenities include ${selected.map(p=>`${p.name} (${p.label.toLowerCase()}, ${p.miles.toFixed(1)} miles)`).join('; ')}. Distances are measured in a straight line from the recorded development location.`;
}
