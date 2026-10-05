import {expect,it} from 'vitest';
import {sitePropertyFacet,filterSites,propertyStyle,type SiteCard,type SiteFilters} from '../src/web/site-filters';
const filters:SiteFilters={developer:'',country:'',minPrice:'',maxPrice:'',minBeds:'',maxBeds:'',style:'',radius:''};
const card:SiteCard={key:'one',name:'Site',developer:'Builder',image:'/image',description:'Interior',count:1,country:'England',latitude:51.5,longitude:-.1,properties:[{price:300000,bedrooms:3,style:'Semi-detached'},{price:800000,bedrooms:5,style:'Detached'}]};
it('requires property filters to match the same advertised home',()=>{expect(filterSites([card],{...filters,maxPrice:'400000',minBeds:'5'},null)).toHaveLength(0);expect(filterSites([card],{...filters,minPrice:'750000',maxBeds:'5',style:'Detached'},null)).toHaveLength(1);});
it('combines developer, country and price limits inclusively',()=>{expect(filterSites([card],{...filters,developer:'Builder',country:'England',minPrice:'300000',maxPrice:'300000'},null)).toHaveLength(1);expect(filterSites([card],{...filters,country:'Scotland'},null)).toHaveLength(0);});
it('excludes missing locations when distance is active without excluding them from unfiltered lists',()=>{const unknown={...card,key:'unknown',latitude:undefined,longitude:undefined};expect(filterSites([card,unknown],filters,null)).toHaveLength(2);const result=filterSites([card,unknown],{...filters,radius:'5'},{latitude:51.5,longitude:-.1});expect(result).toHaveLength(1);expect(result[0]?.miles).toBe(0);});
it('excludes unknown prices, bedrooms and styles from active numeric or style filters',()=>{const unknown={...card,properties:[{price:null,bedrooms:null,style:null}]};expect(filterSites([unknown],{...filters,maxPrice:'900000'},null)).toHaveLength(0);expect(filterSites([unknown],{...filters,maxBeds:'6'},null)).toHaveLength(0);expect(filterSites([unknown],{...filters,style:'Detached'},null)).toHaveLength(0);});
it('distinguishes semi-detached and attached styles from detached',()=>{expect(propertyStyle('Semi-detached house',true)).toBe('Semi-detached');expect(propertyStyle('Terraced house',false)).toBe('Attached / terraced');expect(propertyStyle('Detached house',true)).toBe('Detached');expect(propertyStyle(null,false)).toBeNull();});

it('cascades bedroom and price facets through the same homes and the selected builder',()=>{
 const other={...card,key:'other',developer:'Other',properties:[{price:100000,bedrooms:1,style:null}]};
 expect(sitePropertyFacet([card,other],{...filters,developer:'Builder',minBeds:'5'},null,'price').map(p=>p.price)).toEqual([800000]);
 expect(sitePropertyFacet([card,other],{...filters,developer:'Builder',maxPrice:'400000'},null,'bedrooms').map(p=>p.bedrooms)).toEqual([3]);
 expect(sitePropertyFacet([card],{...filters,minBeds:'5',radius:'5'},{latitude:55,longitude:-4},'price')).toEqual([]);
});
