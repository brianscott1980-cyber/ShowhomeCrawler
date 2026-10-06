import {expect,it} from 'vitest';
import {developmentNavigationImages} from '../src/web/development-navigation-images';
import type {RunReport} from '../src/reports/report';
it('selects exteriors and interiors only from the current builder and development',()=>{
 const image=(id:string,mainCategory:string)=>({id,path:id+'.jpg',categorisation:{mainCategory,isRoom:true}});
 const report={properties:[{name:'House',developmentUrl:'/current',imageIds:['front','room','plan']},{name:'House',developmentUrl:'/other',imageIds:['other']}],images:[image('other','Bedroom'),image('plan','Floorplan'),image('front','Exterior'),image('room','Bedroom')]} as unknown as RunReport;
 const result=developmentNavigationImages([{slug:'wrong',report},{slug:'builder',report}],'builder','/current');
 expect(result.exterior?.image.id).toBe('front');expect(result.interior?.image.id).toBe('room');expect(result.interior?.slug).toBe('builder');
});
it('does not substitute an exterior for a missing interior or a gallery image for a building exterior',()=>{
 const report={properties:[{name:'Development gallery',developmentUrl:'/current',imageIds:['front']}],images:[{id:'front',categorisation:{mainCategory:'Exterior',isRoom:true}}]} as unknown as RunReport;
 expect(developmentNavigationImages([{slug:'builder',report}],'builder','/current')).toEqual({exterior:undefined,interior:undefined});
});
it('does not infer categories from media paths when classification is absent',()=>{
 const report={properties:[{name:'House',developmentUrl:'/landsdale',imageIds:['other','cgi','front','room']}],images:[{id:'other',sourceUrl:'https://cms.bellway.co.uk/Showhome-Photography/Home/other/_large/1/Home_03.webp'},{id:'cgi',sourceUrl:'https://cms.bellway.co.uk/landsdale/CGIs/_large/2/House.webp'},{id:'front',sourceUrl:'https://cms.bellway.co.uk/Showhome-Photography/Home/Landsdale/_large/3/Home_01.webp'},{id:'room',sourceUrl:'https://cms.bellway.co.uk/Showhome-Photography/Home/Landsdale/_large/4/Home_03.webp'}]} as unknown as RunReport;
 const result=developmentNavigationImages([{slug:'bellway',report}],'bellway','/landsdale');
 expect(result).toEqual({exterior:undefined,interior:undefined});
});
