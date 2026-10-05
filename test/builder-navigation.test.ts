import {expect,it,vi} from 'vitest';
vi.mock('../src/web/collections',()=>({developers:[{slug:'example',name:'Example Homes',website:'https://example.com'}],readCollection:async()=>null,assetUrl:()=>''}));
vi.mock('../src/web/location-geography',()=>({readLocationRows:async()=>[]}));
vi.mock('../src/web/groups',()=>({groupCollections:()=>[],spaceName:()=>''}));
import BuilderPage from '../src/page-views/developers/[slug]/page';

it('keeps breadcrumb URLs clean even when opening an old filtered link',async()=>{
 const page=await BuilderPage({params:Promise.resolve({slug:'example'}),searchParams:Promise.resolve({radius:'25',region:'Scotland',order:'distance'})});
 expect(page.props.back.href).toBe('/builders');
});
it('keeps direct visits unfiltered',async()=>{
 const page=await BuilderPage({params:Promise.resolve({slug:'example'})});
 expect(page.props.back.href).toBe('/builders');
});
