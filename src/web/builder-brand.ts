import {developers,type DeveloperSlug} from '../adapters/developers';
export interface BuilderBrand {primary:string;secondary:string;parts:readonly [string,...string[]]}
// Logo hues and tonal companions from the local official marks.
export const builderBrands:Record<DeveloperSlug,BuilderBrand>={
 'bellway':{primary:'#f3613c',secondary:'#a63c22',parts:['Bellway']},
 'cala':{primary:'#454545',secondary:'#6b6b6b',parts:['Cala']},
 'barratt':{primary:'#333333',secondary:'#666666',parts:['Barratt']},
 'taylor-wimpey':{primary:'#C61A41',secondary:'#3B1953',parts:['Taylor ','Wimpey']},
 'david-wilson':{primary:'#333333',secondary:'#a97742',parts:['David Wilson ','Homes']},
 'miller-homes':{primary:'#0C1975',secondary:'#009BAA',parts:['Miller ','Homes']},
 'avant':{primary:'#9d1d64',secondary:'#6c1445',parts:['Avant']},
 'springfield':{primary:'#4A7729',secondary:'#63A50B',parts:['Springfield']},
 'persimmon':{primary:'#004d50',secondary:'#008561',parts:['Persimmon']},
 'robertson-homes':{primary:'#333333',secondary:'#666666',parts:['Robertson ','Homes']},
 'redrow':{primary:'#d01030',secondary:'#960c23',parts:['Redrow']},
 'berkeley-group':{primary:'#d10020',secondary:'#111111',parts:['The Berkeley ','Group']},
 'crest-nicholson':{primary:'#002246',secondary:'#3b5875',parts:['Crest ','Nicholson']},
 'tulloch-homes':{primary:'#006937',secondary:'#63a51d',parts:['Tulloch ','Homes']},
 'scotia-homes':{primary:'#131e29',secondary:'#b18c4a',parts:['Scotia ','Homes']},
 'lynch-homes':{primary:'#333333',secondary:'#666666',parts:['Lynch ','Homes']},
 'story-homes':{primary:'#003f60',secondary:'#6b6052',parts:['Story ','Homes']},
 'hill-group':{primary:'#111111',secondary:'#666666',parts:['Hill ','Group']},
 'bovis-homes':{primary:'#143858',secondary:'#666666',parts:['Bovis Homes']},
 'linden-homes':{primary:'#890a3d',secondary:'#666666',parts:['Linden Homes']},
 'countryside-homes':{primary:'#003840',secondary:'#666666',parts:['Countryside Homes']},
 'bloor-homes':{primary:'#003865',secondary:'#75787b',parts:['Bloor Homes']},
 'keepmoat':{primary:'#004179',secondary:'#f9b247',parts:['Keepmoat']},
 'gleeson':{primary:'#49a942',secondary:'#1e392a',parts:['Gleeson Homes']},
 'morris-homes':{primary:'#00396f',secondary:'#00a4e8',parts:['Morris Homes']},
 'harron-homes':{primary:'#e84129',secondary:'#161412',parts:['Harron Homes']},
 'anwyl-homes':{primary:'#003a5d',secondary:'#00bbb4',parts:['Anwyl ','Homes']},
 'castle-green-homes':{primary:'#384d3b',secondary:'#667961',parts:['Castle Green ','Homes']},
 'lovell':{primary:'#c10a27',secondary:'#701427',parts:['Lovell ','Homes']},
};
/** Keep logo hues while adjusting brightness for readable text on its background. */
export function brandTextColour(colour:string,background='#ffffff'):string {
 const parse=(hex:string)=>[1,3,5].map(start=>parseInt(hex.slice(start,start+2),16));
 const rgb=parse(colour);
 const luminance=(values:number[])=>values.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i]!,0);
 const backdrop=luminance(parse(background));
 const contrast=()=>{const text=luminance(rgb);return (Math.max(text,backdrop)+.05)/(Math.min(text,backdrop)+.05);};
 while(contrast()<4.5){for(let i=0;i<3;i++)rgb[i]=backdrop>.179?Math.floor(rgb[i]!*.95):Math.ceil(rgb[i]!+(255-rgb[i]!)*.05);}
 return '#'+rgb.map(v=>v.toString(16).padStart(2,'0')).join('');
}
export function builderBrand(nameOrSlug:string){const developer=developers.find(d=>d.slug===nameOrSlug||d.name===nameOrSlug);return developer?builderBrands[developer.slug]:undefined;}
export function builderNameHtml(nameOrSlug:string,background='#ffffff'){
 const brand=builderBrand(nameOrSlug);if(!brand)return nameOrSlug.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
 return brand.parts.map((part,i)=>`<i style="font:inherit;color:${brandTextColour(i===0?brand.primary:brand.secondary,background)}">${part}</i>`).join('');
}
