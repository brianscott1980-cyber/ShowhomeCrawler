const days=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const dayPattern='Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Mon|Tue(?:s)?|Wed|Thu(?:rs)?|Fri|Sat|Sun|Mo|Tu|We|Th|Fr|Sa|Su';
const timePattern='\\d{1,2}(?:[:.]\\d{2})?\\s*(?:am|pm)?';
function minutes(time:string){
 const match=time.trim().match(/^(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?$/i);if(!match)return null;
 let hour=Number(match[1]);const minute=Number(match[2]??0),period=match[3]?.toLowerCase();
 if(minute>59||(period?(hour<1||hour>12):hour>23))return null;
 if(period)hour=hour%12+(period==='pm'?12:0);
 return hour*60+minute;
}
function clock(value:number){return `${String(Math.floor(value/60)%24).padStart(2,'0')}:${String(value%60).padStart(2,'0')}`;}
/** Interpret explicit weekly day/time ranges; leave ambiguous prose unclassified. */
export function openingHoursStatus(lines:string[],now:Date){
 const windows:{day:number;start:number;end:number}[]=[];
 const pattern=new RegExp(`((?:${dayPattern})(?:\\s*(?:,|and|&|[-–]|to)\\s*(?:${dayPattern}))*)\\s*:?\\s*(${timePattern})\\s*[-–]\\s*(${timePattern})`,'gi');
 for(const line of lines)for(const match of line.matchAll(pattern)){
  const start=minutes(match[2]!),end=minutes(match[3]!);if(start===null||end===null||start===end)continue;
  const labels=match[1]!.match(new RegExp(dayPattern,'gi'))??[];
  const indices=labels.map(label=>days.findIndex(day=>day.toLowerCase().startsWith(label.slice(0,2).toLowerCase())));
  const selected=new Set(indices);
  if(/[-–]|\bto\b/i.test(match[1]!)&&indices.length===2){let day=indices[0]!;while(day!==indices[1]){selected.add(day);day=(day+1)%7;}}
  for(const day of selected)windows.push({day,start,end:end<start?end+1440:end});
 }
 if(!windows.length)return 'View Opening Hours';
 const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',weekday:'long',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now);
 const part=(type:string)=>parts.find(part=>part.type===type)?.value??'';
 const today=days.indexOf(part('weekday')),minute=Number(part('hour'))*60+Number(part('minute'));
 const open=windows.find(window=>window.day===today&&minute>=window.start&&minute<window.end||window.end>1440&&(window.day+1)%7===today&&minute<window.end-1440);
 if(open)return `Open Until ${clock(open.end)}`;
 const next=windows.map(window=>({...window,wait:((window.day-today+7)%7)*1440+window.start-minute})).map(window=>({...window,wait:window.wait<0?window.wait+7*1440:window.wait})).sort((a,b)=>a.wait-b.wait)[0]!;
 return next.day===today&&next.wait<1440?`Opening At ${clock(next.start)}`:`Next Open ${days[next.day]!.slice(0,3)} At ${clock(next.start)}`;
}

export function abbreviateOpeningDays(text:string){return text.replace(/Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday/g,day=>day.slice(0,3));}
