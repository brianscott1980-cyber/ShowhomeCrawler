import {developers,type DeveloperSlug} from '../adapters/developers';
export interface BuilderBrand {primary:string;secondary:string;logoBackground:string;parts:readonly [string,...string[]]}
// Logo hues and tonal companions from the local official marks.
export const builderBrands:Record<DeveloperSlug,BuilderBrand>={
 'bellway':{logoBackground:'#ffffff',primary:'#f3613c',secondary:'#a63c22',parts:['Bellway']},
 'cala':{logoBackground:'#163f48',primary:'#454545',secondary:'#6b6b6b',parts:['Cala']},
 'barratt':{logoBackground:'#163f48',primary:'#333333',secondary:'#666666',parts:['Barratt']},
 'taylor-wimpey':{logoBackground:'#ffffff',primary:'#C61A41',secondary:'#3B1953',parts:['Taylor ','Wimpey']},
 'david-wilson':{logoBackground:'#163f48',primary:'#333333',secondary:'#a97742',parts:['David Wilson ','Homes']},
 'miller-homes':{logoBackground:'#ffffff',primary:'#0C1975',secondary:'#009BAA',parts:['Miller ','Homes']},
 'avant':{logoBackground:'#ffffff',primary:'#9d1d64',secondary:'#6c1445',parts:['Avant']},
 'springfield':{logoBackground:'#ffffff',primary:'#4A7729',secondary:'#63A50B',parts:['Springfield']},
 'persimmon':{logoBackground:'#ffffff',primary:'#004d50',secondary:'#008561',parts:['Persimmon']},
 'robertson-homes':{logoBackground:'#163f48',primary:'#333333',secondary:'#666666',parts:['Robertson ','Homes']},
 'redrow':{logoBackground:'#ffffff',primary:'#d01030',secondary:'#960c23',parts:['Redrow']},
 'berkeley-group':{logoBackground:'#ffffff',primary:'#d10020',secondary:'#111111',parts:['The Berkeley ','Group']},
 'crest-nicholson':{logoBackground:'#ffffff',primary:'#002246',secondary:'#3b5875',parts:['Crest ','Nicholson']},
 'tulloch-homes':{logoBackground:'#ffffff',primary:'#006937',secondary:'#63a51d',parts:['Tulloch ','Homes']},
 'scotia-homes':{logoBackground:'#ffffff',primary:'#131e29',secondary:'#b18c4a',parts:['Scotia ','Homes']},
 'lynch-homes':{logoBackground:'#163f48',primary:'#333333',secondary:'#666666',parts:['Lynch ','Homes']},
 'story-homes':{logoBackground:'#013c5e',primary:'#003f60',secondary:'#6b6052',parts:['Story ','Homes']},
 'hill-group':{logoBackground:'#ffffff',primary:'#111111',secondary:'#666666',parts:['Hill ','Group']},
 'bovis-homes':{logoBackground:'#ffffff',primary:'#143858',secondary:'#666666',parts:['Bovis Homes']},
 'linden-homes':{logoBackground:'#ffffff',primary:'#890a3d',secondary:'#666666',parts:['Linden Homes']},
 'countryside-homes':{logoBackground:'#ffffff',primary:'#003840',secondary:'#666666',parts:['Countryside Homes']},
 'bloor-homes':{logoBackground:'#003865',primary:'#003865',secondary:'#75787b',parts:['Bloor Homes']},
 'keepmoat':{logoBackground:'#ffffff',primary:'#004179',secondary:'#f9b247',parts:['Keepmoat']},
 'gleeson':{logoBackground:'#ffffff',primary:'#49a942',secondary:'#1e392a',parts:['Gleeson Homes']},
 'morris-homes':{logoBackground:'#ffffff',primary:'#00396f',secondary:'#00a4e8',parts:['Morris Homes']},
 'harron-homes':{logoBackground:'#161412',primary:'#e84129',secondary:'#161412',parts:['Harron Homes']},
 'anwyl-homes':{logoBackground:'#ffffff',primary:'#003a5d',secondary:'#00bbb4',parts:['Anwyl ','Homes']},
 'castle-green-homes':{logoBackground:'#212822',primary:'#384d3b',secondary:'#667961',parts:['Castle Green ','Homes']},
 'lovell':{logoBackground:'#ffffff',primary:'#c10a27',secondary:'#701427',parts:['Lovell ','Homes']},
 'wain-homes':{logoBackground:'#ffffff',primary:'#141c4b',secondary:'#e61b48',parts:['Wain ','Homes']},
 'dandara':{logoBackground:'#ffffff',primary:'#153050',secondary:'#7dbeb7',parts:['Dandara']},
 'maguires-developments':{logoBackground:'#000000',primary:'#c5b358',secondary:'#319aad',parts:['Maguires ','Developments']},
 'bancon-homes':{logoBackground:'#ffffff',primary:'#111111',secondary:'#555555',parts:['Bancon ','Homes']},
 'ajc-homes':{logoBackground:'#c41230',primary:'#c41230',secondary:'#ffffff',parts:['AJC ','Homes']},
 'hayhill':{logoBackground:'#ffffff',primary:'#C11F3D',secondary:'#969899',parts:['Hayhill Developments']},
 'hopkins-homes':{logoBackground:'#ffffff',primary:'#ccaf74',secondary:'#242245',parts:['Hopkins ','Homes']},
 'larkfleet-homes':{logoBackground:'#ffffff',primary:'#b88e00',secondary:'#111111',parts:['Larkfleet ','Homes']},
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

/** The logo slide backdrop is independent of the builder’s primary text colour. */
export function builderLogoBackground(slug:DeveloperSlug):string {
 return builderBrands[slug].logoBackground;
}
