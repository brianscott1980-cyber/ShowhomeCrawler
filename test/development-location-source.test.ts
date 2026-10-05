import {expect,it} from 'vitest';
import {extractDevelopmentCoordinates} from '../src/web/development-location-source';
it('uses development coordinates and postal codes from structured data',()=>{
 const html='<script type="application/ld+json">'+JSON.stringify({'@type':'Residence',geo:{latitude:55.8,longitude:-4.2},address:{postalCode:'G75 8AA'}})+'</script>';
 expect(extractDevelopmentCoordinates(html,'https://builder.test/development')).toEqual({latitude:55.8,longitude:-4.2,postcode:'G75 8AA'});
});
it('does not use the builder head-office coordinates',()=>{
 const html='<script type="application/ld+json">'+JSON.stringify({'@type':'Organization',geo:{latitude:55.8,longitude:-4.2},address:{postalCode:'G75 8AA'}})+'</script>';
 expect(extractDevelopmentCoordinates(html,'https://builder.test/development').latitude).toBeUndefined();
});
