import {expect,it} from 'vitest';
import {sharedImageCards,roomLabel} from '../src/web/shared-image-cards';
import {homeTypeName} from '../src/reports/home-display';
import type {GalleryImage} from '../src/web/gallery-page-data';
it('lists a shared image separately for each house type while keeping repeated development memberships together',()=>{
 const image={uid:'builder:image',homes:[{name:'The Osborne',development:'A'},{name:'The Osborne',development:'B'},{name:'The Moray',development:'A'}]} as GalleryImage;
 const cards=sharedImageCards(image);
 expect(cards).toHaveLength(2);expect(cards[0]?.homes).toHaveLength(2);expect(cards[1]?.homes.map(home=>home.name)).toEqual(['The Moray']);
 expect(new Set(cards.map(card=>card.uid)).size).toBe(2);expect(cards.every(card=>card.imageUid===image.uid)).toBe(true);
});
it('cleans empty-room labels and navigation text in house names',()=>{
 expect(roomLabel('Empty room')).toBe('Empty');
 expect(homeTypeName('The Moray More Information')).toBe('The Moray');
 expect(homeTypeName('The Osborne · More Information')).toBe('The Osborne');
});
