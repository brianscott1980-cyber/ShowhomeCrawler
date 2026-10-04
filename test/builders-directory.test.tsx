import {expect,it,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
vi.mock('../src/web/collections',()=>({assetUrl:(slug:string,path:string)=>`/api/assets/${slug}/${path}`,developers:[{slug:'lynch-homes',name:'Lynch Homes'}],readCollection:async()=>({images:[{id:'exterior',path:'images/exterior.jpg',verdict:{matches:false,description:'House exterior'},categorisation:{isRoom:false,mainCategory:'Exterior'}}],properties:[]})}));
import Builders from '../src/page-views/homebuilders/page';
it('shows a builder with categorised property photographs even when there are no office matches',async()=>{
 const html=renderToStaticMarkup(await Builders());
 expect(html).toContain('<h1 id="builders-heading">Builders</h1>');
 expect(html).toContain('/developers/lynch-homes');
 expect(html).toContain('Lynch Homes');
});
