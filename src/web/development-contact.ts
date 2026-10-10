import {load} from 'cheerio';
export interface DevelopmentContact {telephone?:string;email?:string;address?:string;sourceUrl?:string;checkedAt?:string;siteForeman?:string;siteSalesperson?:string;openingHours?:string[]}
/** Read explicitly published development contact information from its page. */
export function developmentContact(html:string):DevelopmentContact{
 const $=load(html),contact:DevelopmentContact={};
 $('header,footer,nav').remove();
 const phone=$('a[href^="tel:"]').first();
 const telephone=phone.attr('href')?.slice(4).trim();
 if(telephone&&/^[+\d\s().-]+$/.test(telephone))contact.telephone=telephone;
 const email=$('a[href^="mailto:"]').first().attr('href')?.slice(7).split('?')[0]?.trim();
 if(email&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))contact.email=email;
 const hours:string[]=[];
 $('script[type="application/ld+json"]').each((_,element)=>{
  try{
   const visit=(value:unknown)=>{
    if(!value||typeof value!=='object')return;
    if(Array.isArray(value)){value.forEach(visit);return;}
    const item=value as Record<string,unknown>;
    // Avoid importing the parent company's general contact details.
    if(['LocalBusiness','RealEstateAgent','Residence'].includes(String(item['@type']))){
     if(item.address&&typeof item.address==='object'){const address=item.address as Record<string,unknown>;contact.address=[address.streetAddress,address.addressLocality,address.addressRegion,address.postalCode].filter(v=>typeof v==='string'&&v.trim()).join(', ')||contact.address;}
     if(!contact.telephone&&typeof item.telephone==='string')contact.telephone=item.telephone;
     if(!contact.email&&typeof item.email==='string')contact.email=item.email;
     const raw=item.openingHours;
     if(typeof raw==='string')hours.push(raw);
     if(Array.isArray(raw))hours.push(...raw.filter((entry):entry is string=>typeof entry==='string'));
     const entries=item.openingHoursSpecification;
     for(const entry of Array.isArray(entries)?entries:entries?[entries]:[]){
      if(!entry||typeof entry!=='object')continue;
      const spec=entry as Record<string,unknown>;
      const days=(Array.isArray(spec.dayOfWeek)?spec.dayOfWeek:[spec.dayOfWeek]).filter(Boolean).map(day=>String(day).split('/').at(-1)).join(', ');
      if(days&&spec.opens&&spec.closes)hours.push(`${days}: ${spec.opens} – ${spec.closes}`);
     }
    }
    if(item['@graph'])visit(item['@graph']);
   };
   visit(JSON.parse($(element).text()));
  }catch{/* Invalid structured data does not become a contact claim. */}
 });
 $('[class*="opening-hours"], [class*="opening_hours"], [id*="opening-hours"]').each((_,element)=>{
  const node=$(element);if(node.find('[class*="opening-hours"], [class*="opening_hours"]').length)return;
  const text=node.text().replace(/\s+/g,' ').trim();
  if(/(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Mon\b|Tue\b)/i.test(text)&&/\d{1,2}[:.]\d{2}|closed/i.test(text))hours.push(text);
 });
 if(hours.length)contact.openingHours=[...new Set(hours)];
 $('dt').each((_,element)=>{const label=$(element).text().trim().toLowerCase(),value=$(element).next('dd').text().trim();if(value&&label==='site foreman')contact.siteForeman=value;if(value&&label==='site salesperson')contact.siteSalesperson=value;});
 return contact;
}
