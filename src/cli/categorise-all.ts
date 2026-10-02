import { readdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import dotenv from 'dotenv';
import postgres from 'postgres';
import { categoriseAllImages } from '../vision/image-categoriser.js';
import type { RunReport, ImageCategorisation } from '../reports/report.js';

// Load env
dotenv.config();
dotenv.config({ path: '.env.local' });

async function main() {
 const resultsDir = resolve('results');
 const collectionsDir = resolve('collections');
 const entries = await readdir(resultsDir, { withFileTypes: true });
 const builderFolders = entries
  .filter(e => e.isDirectory() && e.name.endsWith('-home-offices'))
  .map(e => e.name)
  .sort();

 console.log(`Found ${builderFolders.length} builder folders in ${resultsDir}`);

 let totalImages = 0;
 const allImagesMap = new Map<string, { id: string; roomType?: string; description?: string; reason?: string }>();
 const builderReports = new Map<string, RunReport>();

 for (const folder of builderFolders) {
  const jsonPath = resolve(resultsDir, folder, 'results.json');
  if (!existsSync(jsonPath)) continue;
  try {
   const report: RunReport = JSON.parse(await readFile(jsonPath, 'utf8'));
   builderReports.set(folder, report);
   for (const img of report.images) {
    totalImages++;
    allImagesMap.set(img.id, {
     id: img.id,
     roomType: img.verdict?.roomType,
     description: img.verdict?.description,
     reason: img.verdict?.reason,
    });
   }
  } catch (err) {
   console.error(`Error reading ${jsonPath}:`, err);
  }
 }

 console.log(`Total unique images across builders: ${allImagesMap.size} (total image references: ${totalImages})`);
 console.log('Categorising all images...');

 const categorisations = await categoriseAllImages(
  [...allImagesMap.values()],
  process.env.GEMINI_API_KEY,
  {
   onProgress: (done, total) => {
    if (done === total || done % 500 === 0) {
     console.log(`Progress: ${done} / ${total} images categorised`);
    }
   }
  }
 );

 console.log('Categorisation complete. Updating results and collections JSON files...');

 const categoryStats = new Map<string, number>();
 const subCategoryStats = new Map<string, number>();

 for (const [folder, report] of builderReports.entries()) {
  let modified = false;
  for (const img of report.images) {
   const cat = categorisations.get(img.id);
   if (cat) {
    img.categorisation = cat;
    modified = true;
    categoryStats.set(cat.mainCategory, (categoryStats.get(cat.mainCategory) || 0) + 1);
    const subKey = `${cat.mainCategory} -> ${cat.subCategory}`;
    subCategoryStats.set(subKey, (subCategoryStats.get(subKey) || 0) + 1);
   }
  }

  if (modified) {
   // Write to results
   const resultsPath = resolve(resultsDir, folder, 'results.json');
   await writeFile(resultsPath, JSON.stringify(report, null, 2));

   // Write to collections if exists
   const collPath = resolve(collectionsDir, folder, 'results.json');
   if (existsSync(collPath)) {
    try {
     const collReport: RunReport = JSON.parse(await readFile(collPath, 'utf8'));
     for (const cImg of collReport.images) {
      const cat = categorisations.get(cImg.id);
      if (cat) cImg.categorisation = cat;
     }
     await writeFile(collPath, JSON.stringify(collReport, null, 2));
    } catch (e) {
     console.warn(`Could not update collections report ${collPath}:`, e);
    }
   }
  }
 }

 console.log('\n--- Categorisation Summary ---');
 console.log('Main Categories:');
 for (const [cat, count] of [...categoryStats.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${cat.padEnd(25)}: ${count}`);
 }

 console.log('\nTop Subcategories:');
 for (const [sub, count] of [...subCategoryStats.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30)) {
  console.log(`  ${sub.padEnd(45)}: ${count}`);
 }

 // Database sync if DATABASE_URL is set
 const dbUrl = process.env.DATABASE_URL;
 if (dbUrl) {
  console.log('\nDATABASE_URL detected. Syncing categorisations to Supabase public.images...');
  const sql = postgres(dbUrl, { max: 3, ssl: 'require', connect_timeout: 10 });
  try {
   const updates: { sha256: string; room_type: string; tags: string[]; objects: ImageCategorisation }[] = [];
   for (const [id, cat] of categorisations.entries()) {
    const tags = [
     cat.subCategory,
     ...cat.colours,
     ...cat.chairs,
     ...(cat.wallpaper ? [cat.wallpaper] : []),
     ...(cat.curtains ? [cat.curtains] : []),
     ...(cat.hasTelevision ? ['Television'] : []),
     ...(cat.hasComputer ? ['Computer / Desk'] : [])
    ];
    updates.push({
     sha256: id,
     room_type: cat.mainCategory,
     tags,
     objects: cat
    });
   }

   const chunkSize = 200;
   let updatedCount = 0;
   for (let i = 0; i < updates.length; i += chunkSize) {
    const chunk = updates.slice(i, i + chunkSize);
    await sql.unsafe(`
     update public.images as i set
      room_type = c.room_type,
      tags = c.tags::text[],
      objects = c.objects::jsonb,
      updated_at = now()
     from (
      select
       item->>'sha256' as sha256,
       item->>'room_type' as room_type,
       array(select jsonb_array_elements_text(item->'tags')) as tags,
       item->'objects' as objects
      from jsonb_array_elements($1::jsonb) as item
     ) as c
     where i.sha256 = c.sha256
    `, [sql.json(chunk as any)]);
    updatedCount += chunk.length;
    if (updatedCount % 1000 === 0 || updatedCount === updates.length) {
     console.log(`Synced ${updatedCount} / ${updates.length} image rows to database...`);
    }
   }
   console.log('Database sync complete!');
  } catch (dbErr) {
   console.error('Database sync encountered an error:', dbErr);
  } finally {
   await sql.end();
  }
 } else {
  console.log('\nNo DATABASE_URL found. Skipping Postgres sync.');
 }

 console.log('\nAll images categorised successfully!');
}

main().catch(err => {
 console.error('Categorisation script failed:', err);
 process.exit(1);
});
