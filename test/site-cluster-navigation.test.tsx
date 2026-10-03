import {it,expect,vi} from 'vitest';
import {JSDOM} from 'jsdom';
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {SiteMap} from '../src/web/site-map';
const state=vi.hoisted(()=>({instance:null as any}));
vi.mock('maplibre-gl',()=>({
 setWorkerUrl:vi.fn(),NavigationControl:class {},LngLatBounds:class {},
 Map:class {
  handlers=new Map<string,Function>();center={lng:0,lat:51};zoom=5;
  source={setData:vi.fn(),getClusterExpansionZoom:vi.fn(async()=>9),getClusterLeaves:vi.fn(async(id:number)=>[{properties:{key:id===7?'one':'other'}}])};
  loadImage=vi.fn(async()=>({data:{}}));addImage=vi.fn();
  queryRenderedFeatures=vi.fn(()=>[] as any[]);setPaintProperty=vi.fn();layers:any[]=[];
  easeTo=vi.fn();stop=vi.fn();remove=vi.fn();resize=vi.fn();
  constructor(){state.instance=this;queueMicrotask(()=>this.handlers.get('load')?.());}
  on(event:string,layerOrHandler:string|Function,handler?:Function){this.handlers.set(handler?event+':'+layerOrHandler:event,handler??layerOrHandler as Function);}
  off(event:string){this.handlers.delete(event);}
  addControl(){} addSource(){} addLayer(layer:any){this.layers.push(layer);} getSource(){return this.source;}
  getCenter(){return this.center;}getZoom(){return this.zoom;}getMaxZoom(){return 22;}isStyleLoaded(){return true;}
  getCanvas(){return document.createElement('canvas');}
  getBounds(){return {getWest:()=>this.center.lng-1,getEast:()=>this.center.lng+1,getSouth:()=>this.center.lat-1,getNorth:()=>this.center.lat+1,contains:()=>true};}
  jumpTo=vi.fn((next:{center:[number,number];zoom:number})=>{this.center={lng:next.center[0],lat:next.center[1]};this.zoom=next.zoom;this.handlers.get('moveend')?.();});
 },
 Marker:class {element:HTMLElement;constructor({element}:{element:HTMLElement}){this.element=element;}setLngLat(){return this;}addTo(){return this;}remove(){}getElement(){return this.element;}},
}));
it('highlights the containing cluster with its count and retains cluster navigation after list refresh',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'https://local.test'});
 for(const [key,value] of Object.entries({window:dom.window,document:dom.window.document,ResizeObserver:class {observe(){}disconnect(){}},IS_REACT_ACT_ENVIRONMENT:true}))vi.stubGlobal(key,value);
 const root=createRoot(document.getElementById('root')!);
 const card={key:'one',name:'Site',developer:'Gleeson Homes',image:'',description:'',count:1,country:'England',properties:[],latitude:51,longitude:0};
 const bounds=vi.fn(),camera=vi.fn();
 const props={cards:[card],activeKey:'one',camera:{lng:0,lat:51,zoom:5},onBoundsChange:bounds,onCameraChange:camera,onSelect:vi.fn(),onUnavailable:vi.fn()};
 try{
  await act(async()=>root.render(<SiteMap {...props}/>));
  await act(async()=>{await vi.waitFor(()=>expect(state.instance).not.toBeNull());});
  const map=state.instance;
  expect(map.source.setData.mock.calls.at(-1)[0].features[0].properties).toMatchObject({builderColour:'#49a942',builderIcon:'builder-gleeson'});
  expect(map.addImage).toHaveBeenCalledWith('builder-gleeson',{}, {pixelRatio:2});
  const badges=map.layers.find((layer:any)=>layer.id==='site-builder-icons');
  expect(badges.minzoom).toBe(15);
  expect(map.layers.find((layer:any)=>layer.id==='site-dots').paint['circle-color']).toEqual(['get','builderColour']);
  const counts=map.layers.find((layer:any)=>layer.id==='site-cluster-count');
  expect(counts.layout['text-field']).toEqual(['to-string',['get','point_count']]);
  expect(counts.layout['text-allow-overlap']).toBe(true);
  map.queryRenderedFeatures.mockReturnValue([{properties:{cluster_id:8,point_count:3}},{properties:{cluster_id:7,point_count:2}}]);
  await act(async()=>root.render(<SiteMap {...props} activeKey={null} hoverKey="one"/>));
  expect(map.source.getClusterLeaves).toHaveBeenCalledWith(7,2,0);
  expect(map.setPaintProperty).toHaveBeenCalledWith('site-clusters','circle-color',['case',['==',['get','cluster_id'],7],'#b89256','#193963']);
  await act(async()=>root.render(<SiteMap {...props} activeKey={null} hoverKey={null}/>));
  expect(map.setPaintProperty).toHaveBeenLastCalledWith('site-clusters','circle-stroke-width',2);
  await act(async()=>root.render(<SiteMap {...props}/>));
  map.queryRenderedFeatures.mockReturnValue([]);
  await act(async()=>map.handlers.get('idle')?.());
  expect(map.setPaintProperty).toHaveBeenCalledWith('site-clusters','circle-color','#193963');

  map.easeTo.mockClear();
  await act(async()=>map.handlers.get('click:site-clusters')({features:[{geometry:{type:'Point',coordinates:[-3,54]},properties:{cluster_id:7}}]}));
  expect(map.source.getClusterExpansionZoom).toHaveBeenCalledWith(7);
  expect(map.jumpTo).toHaveBeenLastCalledWith({center:[-3,54],zoom:9});
  expect(bounds).toHaveBeenLastCalledWith({west:-4,east:-2,south:53,north:55});
  expect(camera).toHaveBeenLastCalledWith({lng:-3,lat:54,zoom:9});
  await act(async()=>root.render(<SiteMap {...props} cards={[{...card}]} camera={{lng:-3,lat:54,zoom:9}}/>));
  expect(map.easeTo).not.toHaveBeenCalled();
  expect(map.center).toEqual({lng:-3,lat:54});expect(map.zoom).toBe(9);
  expect(map.jumpTo).toHaveBeenCalledTimes(1);
  for(const sequence of [1,2]){
   await act(async()=>root.render(<SiteMap {...props} cards={[{...card}]} camera={{lng:-3,lat:54,zoom:9}} focusSequence={sequence}/>));
   expect(map.easeTo).toHaveBeenLastCalledWith({center:[0,51],duration:450});
   expect(map.easeTo).toHaveBeenCalledTimes(sequence);
  }
 }finally{await act(async()=>root.unmount());dom.window.close();vi.unstubAllGlobals();}
});
