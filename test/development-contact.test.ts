import {expect,it} from 'vitest';
import {developmentContact} from '../src/web/development-contact';
it('reads a development postal address without importing its parent organisation address',()=>{const contact=developmentContact('<script type="application/ld+json">'+JSON.stringify({'@graph':[{'@type':'Organization',address:{streetAddress:'Head office',postalCode:'SW1A 1AA'}},{'@type':['Place','HousingDevelopment'],address:{streetAddress:'Site Road',addressLocality:'Durham',postalCode:'DH1 1AA'}}]})+'</script>');expect(contact.address).toBe('Site Road, Durham, DH1 1AA');});
it('reads published development contacts without using footer contacts',()=>{
 const data=developmentContact('<footer><a href="tel:999">Head office</a></footer><main><a href="tel:01234 567890">Call</a><a href="mailto:sales@example.com?subject=Visit">Email</a><dl><dt>Site Foreman</dt><dd>Alex Smith</dd></dl><div class="opening-hours">Monday 10:00 – 17:00</div></main>');
 expect(data).toEqual({telephone:'01234 567890',email:'sales@example.com',siteForeman:'Alex Smith',openingHours:['Monday 10:00 – 17:00']});
});
it('leaves missing details unset and reads structured opening hours',()=>{
 expect(developmentContact('<p>Meet our team</p>')).toEqual({});
 expect(developmentContact('<script type="application/ld+json">{"@type":"LocalBusiness","openingHoursSpecification":[{"dayOfWeek":"https://schema.org/Monday","opens":"10:00","closes":"17:00"}]}</script>').openingHours).toEqual(['Monday: 10:00 – 17:00']);
});
