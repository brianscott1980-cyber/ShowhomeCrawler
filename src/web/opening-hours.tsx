'use client';
import {useEffect,useState} from 'react';
import {abbreviateOpeningDays,openingHoursStatus,openingHoursDays} from './opening-hours-status';
export function OpeningHours({hours}:{hours?:string[]}){
 const [now,setNow]=useState<Date|null>(null);
 useEffect(()=>{setNow(new Date());const timer=setInterval(()=>setNow(new Date()),60000);return()=>clearInterval(timer);},[]);
 if(!hours?.length)return <>Not available</>;
 const daily=openingHoursDays(hours);
 return <details className="opening-hours-details"><summary><span>{now?openingHoursStatus(hours,now):'View Opening Hours'}</span><svg className="opening-hours-expand" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></summary><div>{daily.length?<dl className="opening-hours-days">{daily.map(entry=><div key={entry.day}><dt>{entry.day}</dt><dd>{entry.hours}</dd></div>)}</dl>:hours.map(line=><span className="development-style" key={line}>{abbreviateOpeningDays(line)}</span>)}</div></details>;
}
