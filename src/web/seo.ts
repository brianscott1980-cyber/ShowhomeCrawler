export const siteUrl = 'https://showhomeexplorer.vercel.app';
export const siteTitle = 'Showhome Explorer | UK Showhome & Home Office Inspiration';
export const siteDescription = 'Explore UK showhome interiors and home office ideas from leading housebuilders. Browse photographs, house types and developments, and save your favourite interiors.';
export const absoluteUrl = (path:string) => new URL(path, siteUrl).href;
export const jsonLd = (value:unknown) => JSON.stringify(value).replace(/</g, '\\u003c');
const escape = (value:string) => value.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function developerSeo(name:string,slug:string,images:{path:string;description?:string}[]) {
 const url=absoluteUrl(`/developers/${slug}`),title=`${name} Showhome & Home Office Ideas | Showhome Explorer`;
 const description=`Explore ${images.length} ${name} showhome interior photographs for home office inspiration. Discover house types, development locations and individual plot details.`;
 const image=images[0]?absoluteUrl(images[0].path):null;
 const schema={'@context':'https://schema.org','@type':'CollectionPage',name:title,description,url,mainEntity:{'@type':'ItemList',numberOfItems:images.length,itemListElement:images.map((i,index)=>({'@type':'ListItem',position:index+1,item:{'@type':'ImageObject',contentUrl:absoluteUrl(i.path),caption:i.description??'Showhome interior'}}))}};
 return `<meta name="description" content="${escape(description)}"><link rel="canonical" href="${url}"><meta name="robots" content="${images.length?'index, follow, max-image-preview:large':'noindex, follow'}"><meta property="og:type" content="website"><meta property="og:site_name" content="Showhome Explorer"><meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(description)}"><meta property="og:url" content="${url}">${image?`<meta property="og:image" content="${escape(image)}">`:''}<meta name="twitter:card" content="${image?'summary_large_image':'summary'}"><script type="application/ld+json">${jsonLd(schema)}</script>`;
}
