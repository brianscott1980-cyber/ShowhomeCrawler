/** Extract only associations explicitly present in the AI's visual description. */
export function decorDetails(description:string,colours:string[]){
 const text=description.toLowerCase();
 const patterns=['Geometric','Floral','Jungle','Botanical','Striped','Textured','Plain'];
 const tags=(noun:string,label:string)=>{
  const result:string[]=[];
  for(const value of [...patterns,...colours]){
   const adjective=value.toLowerCase();
   if(new RegExp(`\\b${adjective}\\b(?:[ -]+[a-z]+){0,2}[ -]+(?:${noun})\\b|\\b(?:${noun})\\b(?:[ -]+(?:are|in)){0,2}[ -]+${adjective}\\b`).test(text))result.push(`${value} ${label}`);
  }
  return result;
 };
 const wallpaperTags=tags('wallpaper','wallpaper');
 if(/\bfeature (?:wall with [a-z -]*wallpaper|wallpaper)\b/.test(text))wallpaperTags.push('Feature wallpaper');
 const curtainTags=tags('curtains?|drapes?','curtains');
 const fabricTags=[...tags('bedding|bed coverings?|duvet(?: covers?)?|bedspread','bedding'),...tags('cushions?|pillows?','cushions'),...tags('tablecloths?|table cloths?','tablecloth')];
 const decor=colours.filter(colour=>{
  const adjective=colour.toLowerCase();
  if(new RegExp(`\\b${adjective} decor\\b`).test(text))return true;
  const items=text.match(new RegExp(`\\b${adjective}\\b(?:[ -]+[a-z]+){0,2}[ -]+(pillows?|cushions?|ornaments?|decorations?|tablecloths?|accent walls?)\\b`,'g'))??[];
  return new Set(items.map(item=>item.replace(new RegExp(`^${adjective}\\s+`),'').replace(/s$/,''))).size>=2;
 }).map(colour=>`${colour} decor`);
 const furnishings:[string,string][]=[['(?:dining |coffee |side |console |bedside )?tables?','table'],['(?:floor |table |pendant )?lamps?','lamp'],['mirrors?','mirror'],['armchairs?','armchair'],['chairs?','chair'],['sofas?','sofa'],['stools?','stool'],['headboards?','headboard'],['sideboards?','sideboard'],['cabinets?','cabinet'],['rugs?','rug'],['vases?','vase']];
 const attributes=[...new Set([...colours,...patterns,'Gold','Brass','Silver','Chrome','Wooden','Oak','Marble','Glass','Velvet','Bouclé','Boucle','Linen','Rattan','Woven','Round','Circular','Oval','Rectangular','Arched','Sculptural','Minimalist','Vintage'])];
 const furnishingTags:string[]=[];
 for(const [noun,label] of furnishings)for(const attribute of attributes){
  const adjective=attribute.toLowerCase();
  if(new RegExp(`\\b${adjective}\\b(?:[ -]+[a-zé]+){0,2}[ -]+(?:${noun})\\b`).test(text))furnishingTags.push(`${attribute==='Boucle'?'Bouclé':attribute} ${label}`);
 }
 return {decor,wallpaperTags,curtainTags,fabricTags,furnishingTags:[...new Set(furnishingTags)]};
}
