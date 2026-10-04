import {afterEach,expect,it,vi} from 'vitest';
import {GET} from '../src/app/api/location/route';
afterEach(()=>vi.unstubAllGlobals());
it.each([
 [{bua:'Hamilton',admin_district:'South Lanarkshire'},'Hamilton'],
 [{parish:'Hextable',admin_district:'Sevenoaks'},'Hextable'],
 [{parish:'South Lanarkshire, unparished area',admin_ward:'Blantyre',admin_district:'South Lanarkshire'},'Blantyre'],
 [{admin_district:'South Lanarkshire'},'South Lanarkshire']
])('uses a local settlement or neighbourhood before the council area',async(fields,expected)=>{
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({result:[{latitude:55.7466,longitude:-4.2316,...fields}]})));
 const response=await GET(new Request('http://localhost/api/location?latitude=55.7466&longitude=-4.2316'));
 expect((await response.json()).area).toBe(expected);
});
it('uses the same local name for postcode lookups',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({result:{postcode:'ML3 6AA',latitude:55.77,longitude:-4.04,bua:'Hamilton',admin_district:'South Lanarkshire'}})));
 const response=await GET(new Request('http://localhost/api/location?postcode=ML3%206AA'));
 expect((await response.json()).area).toBe('Hamilton');
});
