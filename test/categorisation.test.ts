import { describe, it, expect } from 'vitest';
import { extractBaseCategorisation } from '../src/vision/image-categoriser.js';

describe('Image categorisation', () => {
 it('correctly categorises bedrooms and subcategories', () => {
  const master = extractBaseCategorisation('bedroom', 'A master bedroom with king size bed and en-suite access');
  expect(master.mainCategory).toBe('Bedroom');
  expect(master.subCategory).toBe('Master bedroom');
  expect(master.objects).toContain('bed');

  const nursery = extractBaseCategorisation('bedroom', 'A bright nursery with a baby crib and rocking chair');
  expect(nursery.mainCategory).toBe('Bedroom');
  expect(nursery.subCategory).toBe("Child's bedroom / Nursery");

  const small = extractBaseCategorisation('bedroom', 'A children bedroom with single bed and desk');
  expect(small.mainCategory).toBe('Bedroom');
  expect(small.subCategory).toBe('Small bedroom');
  expect(small.objects).toContain('bed');
  expect(small.objects).toContain('desk');
 });

 it('correctly categorises bathrooms and distinguishes toilets/cloakrooms', () => {
  const familyBath = extractBaseCategorisation('bathroom', 'A family bathroom with a bathtub, shower enclosure, and vanity unit');
  expect(familyBath.mainCategory).toBe('Bathroom');
  expect(familyBath.subCategory).toBe('Family bathroom');
  expect(familyBath.objects).toContain('bathtub');
  expect(familyBath.objects).toContain('shower');

  const ensuite = extractBaseCategorisation('en-suite', 'An en suite bathroom with walk-in shower and wash basin');
  expect(ensuite.mainCategory).toBe('Bathroom');
  expect(ensuite.subCategory).toBe('En suite');

  const showerRoom = extractBaseCategorisation('bathroom', 'A shower room with walk-in shower and toilet');
  expect(showerRoom.mainCategory).toBe('Bathroom');
  expect(showerRoom.subCategory).toBe('Shower room');

  const cloakroom = extractBaseCategorisation('cloakroom', 'A downstairs cloakroom toilet with wall-mounted sink');
  expect(cloakroom.mainCategory).toBe('Toilet');
  expect(cloakroom.subCategory).toBe('Cloakroom / WC');
  expect(cloakroom.objects).toContain('toilet');

  const wc = extractBaseCategorisation('bathroom', 'A small powder room or half-bathroom featuring floral wallpaper and toilet');
  expect(wc.mainCategory).toBe('Toilet');
  expect(wc.subCategory).toBe('Cloakroom / WC');
  expect(wc.wallpaper).toBe('Floral botanical');
 });

 it('correctly categorises exteriors and subcategories', () => {
  const front = extractBaseCategorisation('exterior', 'Front exterior view of a detached home with paved driveway and garage');
  expect(front.mainCategory).toBe('Exterior');
  expect(front.subCategory).toBe('House front');
  expect(front.objects).toContain('driveway');
  expect(front.objects).toContain('garage');

  const rear = extractBaseCategorisation('exterior', 'Back of the house with french doors opening to lawn and patio');
  expect(rear.mainCategory).toBe('Exterior');
  expect(rear.subCategory).toBe('House rear');
  expect(rear.objects).toContain('french doors');
  expect(rear.objects).toContain('patio');
  expect(rear.objects).toContain('lawn');

  const garden = extractBaseCategorisation('garden', 'A landscaped lawn garden with fenced border and patio area');
  expect(garden.mainCategory).toBe('Exterior');
  expect(garden.subCategory).toBe('Garden');
 });

 it('correctly categorises kitchens and living rooms', () => {
  const kitchen = extractBaseCategorisation('kitchen', 'A modern fitted kitchen featuring an island with bar stools and navy cabinetry');
  expect(kitchen.mainCategory).toBe('Kitchen');
  expect(kitchen.subCategory).toBe('Kitchen island');
  expect(kitchen.objects).toContain('kitchen island');
  expect(kitchen.objects).toContain('bar stools');
  expect(kitchen.chairs).toContain('Bar stools');
  expect(kitchen.colours).toContain('Navy');

  const lounge = extractBaseCategorisation('living room', 'A formal lounge featuring a grey sofa, armchair, coffee table, and flat-screen television');
  expect(lounge.mainCategory).toBe('Living Room');
  expect(lounge.subCategory).toBe('Formal lounge');
  expect(lounge.objects).toContain('sofa');
  expect(lounge.objects).toContain('coffee table');
  expect(lounge.objects).toContain('television');
  expect(lounge.hasTelevision).toBe(true);
  expect(lounge.chairs).toContain('Armchair');
  expect(lounge.colours).toContain('Grey');
 });

 it('extracts tech objects like TV and Computer', () => {
  const study = extractBaseCategorisation('home office', 'A dedicated study with oak desk, office chair, laptop computer monitor, and bookcase');
  expect(study.mainCategory).toBe('Study & Home Office');
  expect(study.subCategory).toBe('Dedicated study');
  expect(study.hasComputer).toBe(true);
  expect(study.hasTelevision).toBe(false);
  expect(study.objects).toContain('desk');
  expect(study.objects).toContain('computer');
  expect(study.chairs).toContain('Office chair');
  expect(study.colours).toContain('Warm wood / Oak');
 });
});
