import {expect,it} from 'vitest';
import {readFile} from 'node:fs/promises';
import sharp from 'sharp';
import {developers} from '../src/adapters/developers';
import {builderMapBrand,BUILDER_ICON_ZOOM} from '../src/web/builder-map-brand';
it('supplies a retina badge for every builder and resolves names and slugs consistently',async()=>{
 for(const developer of developers){
  const brand=builderMapBrand(developer.name);
  expect(builderMapBrand(developer.slug)).toEqual(brand);
  const png=await readFile(new URL(`../public/maps/builders/${developer.slug}.png`,import.meta.url));
  const metadata=await sharp(png).metadata();
  expect(metadata.width).toBe(64);expect(metadata.height).toBe(64);
  const svg=await readFile(new URL(`../public/maps/builders/${developer.slug}.svg`,import.meta.url),'utf8');
  expect(svg).toContain(`fill="${brand.primary}"`);
  expect(svg).toContain(`>${brand.initial}</text>`);
 }
 expect(builderMapBrand('The Berkeley Group').initial).toBe('B');
 expect(builderMapBrand('Linden Homes').primary).toBe('#890a3d');
 expect(builderMapBrand('Unlisted Builder').slug).toBe('unknown');
 expect(BUILDER_ICON_ZOOM).toBe(15);
});
