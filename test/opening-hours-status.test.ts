import {expect,it} from 'vitest';
import {openingHoursDays,openingHoursStatus} from '../src/web/opening-hours-status';
const hours=['Monday – Friday: 10:00 – 17:00','Saturday, Sunday: 11:00 – 16:00'];
it('uses UK local time for opening, open-until and the next opening',()=>{
 expect(openingHoursStatus(hours,new Date('2026-10-05T08:00:00Z'))).toBe('Opening At 10:00');
 expect(openingHoursStatus(hours,new Date('2026-10-05T10:00:00Z'))).toBe('Open Until 17:00');
 expect(openingHoursStatus(hours,new Date('2026-10-05T16:00:00Z'))).toBe('Next Open Tue At 10:00');
});
it('supports abbreviated days, am/pm and overnight hours',()=>{
 expect(openingHoursStatus(['Mo-Fr 10:00-17:00'],new Date('2026-10-05T10:00:00Z'))).toBe('Open Until 17:00');
 expect(openingHoursStatus(['Monday: 10am – 5pm'],new Date('2026-10-05T10:00:00Z'))).toBe('Open Until 17:00');
 expect(openingHoursStatus(['Sunday: 22:00 – 02:00'],new Date('2026-10-04T23:30:00Z'))).toBe('Open Until 02:00');
 expect(openingHoursStatus(['By appointment'],new Date())).toBe('View Opening Hours');
});

it('expands grouped days and closed days into individual rows',()=>{
 const daily=openingHoursDays(['Mon–Fri: 10:00 – 17:00','Sat: 11am – 4pm','Sun: Closed']);
 expect(daily).toHaveLength(7);
 expect(daily[0]).toEqual({day:'Mon',hours:'10:00 – 17:00'});
 expect(daily[4]).toEqual({day:'Fri',hours:'10:00 – 17:00'});
 expect(daily[5]).toEqual({day:'Sat',hours:'11:00 – 16:00'});
 expect(daily[6]).toEqual({day:'Sun',hours:'Closed'});
 expect(openingHoursDays(['Mon: 10:00 – 17:00'])[1]?.hours).toBe('Not available');
});
