import {bedroomSubCategory} from './bedroom-category.js';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ImageCategorisation } from '../reports/report.js';

export { isNonRoom, isRoomImage } from './room-classifier.js';
import { isNonRoom } from './room-classifier.js';

export function extractBaseCategorisation(roomType?: string, description?: string, reason?: string): ImageCategorisation {
 const fullText = `${description || ''} ${reason || ''}`.trim();
 const lower = fullText.toLowerCase();
 const roomLower = (roomType || '').toLowerCase().replace(/_/g, ' ').trim();
 const isRoom = !isNonRoom(roomType, description, reason);

 // 1. Main Category
 let mainCategory = 'Other';

 if (
  /\b(cloakroom|powder room|wc|toilet|w\.c\.)\b/.test(roomLower) ||
  /\b(cloakroom|powder room|half-bathroom|downstairs wc|downstairs toilet|guest toilet)\b/.test(lower) ||
  (/\b(toilet|wc)\b/.test(lower) && !/\b(bath|bathtub|shower)\b/.test(lower))
 ) {
  mainCategory = 'Toilet';
 } else if (/\b(office|study|workstation|desk)\b/.test(roomLower)) {
  mainCategory = 'Study & Home Office';
 } else if (/\b(bedroom|nursery|cot room)\b/.test(roomLower)) {
  mainCategory = 'Bedroom';
 } else if (/\b(living|lounge|sitting|family room|snug)\b/.test(roomLower)) {
  mainCategory = 'Living Room';
 } else if (/\bkitchen\b/.test(roomLower)) {
  mainCategory = 'Kitchen';
 } else if (/\bdining\b/.test(roomLower)) {
  mainCategory = 'Dining Room';
 } else if (/\b(bathroom|en-?suite|shower)\b/.test(roomLower)) {
  mainCategory = 'Bathroom';
 } else if (/\b(hall|hallway|entry|entryway|landing|porch|stairs|staircase|foyer)\b/.test(roomLower)) {
  mainCategory = 'Hallway';
 } else if (/\b(exterior|garden|patio|facade|balcony|street|aerial)\b/.test(roomLower)) {
  mainCategory = 'Exterior';
 } else if (/\b(utility|laundry|boot)\b/.test(roomLower)) {
  mainCategory = 'Utility Room';
 } else if (/\b(dressing|walk-in (closet|wardrobe)|closet)\b/.test(roomLower)) {
  mainCategory = 'Dressing Room';
 } else if (/\b(gym|fitness|workout)\b/.test(roomLower)) {
  mainCategory = 'Home Gym';
 } else if (/\b(media|game|recreation|theater|theatre|cinema|playroom)\b/.test(roomLower)) {
  mainCategory = 'Media & Games Room';
 } else if (/\b(sunroom|conservatory|orangery)\b/.test(roomLower)) {
  mainCategory = 'Conservatory';
 } else if (/\b(floor[ -]?plan|schematic)\b/.test(roomLower)) {
  mainCategory = 'Floorplan';
 } else if (/\b(home office|study room|study desk)\b/.test(lower)) {
  mainCategory = 'Study & Home Office';
 } else if (/\b(bedroom|single bed|double bed|king bed|bunk bed|crib|cot)\b/.test(lower)) {
  mainCategory = 'Bedroom';
 } else if (/\b(living room|lounge area|sitting room|sofa)\b/.test(lower)) {
  mainCategory = 'Living Room';
 } else if (/\b(kitchen|kitchenette|cabinetry|cooker|island)\b/.test(lower)) {
  mainCategory = 'Kitchen';
 } else if (/\b(dining room|dining area|dining table)\b/.test(lower)) {
  mainCategory = 'Dining Room';
 } else if (/\b(bathroom|en-?suite|bathtub|shower enclosure)\b/.test(lower)) {
  mainCategory = 'Bathroom';
 } else if (/\b(hallway|entryway|landing|foyer|staircase)\b/.test(lower)) {
  mainCategory = 'Hallway';
 } else if (/\b(exterior view|front of the house|rear garden|driveway|aerial view)\b/.test(lower)) {
  mainCategory = 'Exterior';
 } else if (/\b(utility room|laundry room|washing machine)\b/.test(lower)) {
  mainCategory = 'Utility Room';
 } else if (/\b(dressing room|walk-in wardrobe|walk-in closet)\b/.test(lower)) {
  mainCategory = 'Dressing Room';
 } else if (/\b(home gym|fitness room)\b/.test(lower)) {
  mainCategory = 'Home Gym';
 } else if (/\b(media room|games room|cinema room|playroom)\b/.test(lower)) {
  mainCategory = 'Media & Games Room';
 } else if (/\b(sunroom|conservatory|orangery)\b/.test(lower)) {
  mainCategory = 'Conservatory';
 } else if (/\bfloor plan\b/.test(lower)) {
  mainCategory = 'Floorplan';
 }

 // 2. Subcategory
 let subCategory = mainCategory;
 if (mainCategory === 'Bedroom') {
  subCategory = bedroomSubCategory(description,roomType,reason);
 } else if (mainCategory === 'Bathroom') {
  if (/\ben-?suite\b/.test(roomLower) || /\ben-?suite\b/.test(lower)) subCategory = 'En suite';
  else if (/\b(walk-in shower|shower enclosure|shower room)\b/.test(lower) && !/\b(bathtub|bath\b)\b/.test(lower)) subCategory = 'Shower room';
  else subCategory = 'Family bathroom';
 } else if (mainCategory === 'Toilet') {
  subCategory = 'Cloakroom / WC';
 } else if (mainCategory === 'Exterior') {
  if (/\b(rear|back of|patio doors|french doors|bi-fold)\b/.test(lower)) subCategory = 'House rear';
  else if (/\b(garden|lawn|patio|turf|decking|fenced garden)\b/.test(lower)) subCategory = 'Garden';
  else if (/\b(balcony|terrace|roof terrace)\b/.test(lower)) subCategory = 'Balcony / Terrace';
  else if (/\b(aerial|street|cul-de-sac|development|site plan)\b/.test(lower)) subCategory = 'Street scene';
  else subCategory = 'House front';
 } else if (mainCategory === 'Kitchen') {
  if (/\b(island|breakfast bar)\b/.test(lower)) subCategory = 'Kitchen island';
  else if (/\b(open-plan|dining|kitchen\/dining|dining table)\b/.test(lower)) subCategory = 'Open-plan kitchen';
  else subCategory = 'Fitted kitchen';
 } else if (mainCategory === 'Living Room') {
  if (/\b(snug|family room|playroom|cinema)\b/.test(lower)) subCategory = 'Snug / Family room';
  else if (/\b(open-plan|dining|kitchen)\b/.test(lower)) subCategory = 'Open-plan living';
  else subCategory = 'Formal lounge';
 } else if (mainCategory === 'Dining Room') {
  if (/\b(open-plan|kitchen)\b/.test(lower)) subCategory = 'Dining area';
  else subCategory = 'Formal dining room';
 } else if (mainCategory === 'Study & Home Office') {
  if (/\b(bedroom.*desk|desk.*bedroom)\b/.test(lower)) subCategory = 'Bedroom workspace';
  else if (/\b(landing|nook|alcove|under-stairs)\b/.test(lower)) subCategory = 'Study nook';
  else subCategory = 'Dedicated study';
 } else if (mainCategory === 'Hallway') {
  if (/\b(stairs|staircase|landing)\b/.test(lower)) subCategory = 'Landing & Stairs';
  else subCategory = 'Entrance hall';
 } else if (mainCategory === 'Utility Room') {
  if (/\bboot\b/.test(lower)) subCategory = 'Boot room';
  else if (/\blaundry\b/.test(lower)) subCategory = 'Laundry room';
  else subCategory = 'Utility room';
 } else if (mainCategory === 'Dressing Room') {
  if (/\bwalk-in\b/.test(lower)) subCategory = 'Walk-in wardrobe';
  else subCategory = 'Dressing room';
 } else if (mainCategory === 'Home Gym') {
  subCategory = 'Fitness room';
 } else if (mainCategory === 'Media & Games Room') {
  if (/\bplayroom\b/.test(lower)) subCategory = 'Playroom';
  else if (/\b(cinema|theater|theatre|media)\b/.test(lower)) subCategory = 'Cinema / Media room';
  else subCategory = 'Games room';
 } else if (mainCategory === 'Conservatory') {
  subCategory = 'Sunroom / Conservatory';
 } else if (mainCategory === 'Other') {
  subCategory = isRoom ? 'Empty room' : 'Document / Graphic';
 }

 // 3. Objects
 const objects: string[] = [];
 const candidateObjects: [string, RegExp][] = [
  ['dining table', /\bdining table\b/],
  ['kitchen island', /\b(island|breakfast bar)\b/],
  ['cabinetry', /\b(cabinetry|cabinets|cupboards|units)\b/],
  ['sofa', /\b(sofa|couch|settee)\b/],
  ['armchair', /\b(armchair|accent chair|lounge chair)\b/],
  ['coffee table', /\bcoffee table\b/],
  ['side table', /\b(side table|end table)\b/],
  ['bed', /\b(bed|headboard|mattress)\b/],
  ['nightstand', /\b(bedside table|nightstand)\b/],
  ['wardrobe', /\b(wardrobe|closet|fitted robes)\b/],
  ['chest of drawers', /\b(chest of drawers|dresser)\b/],
  ['dressing table', /\b(dressing table|vanity desk)\b/],
  ['desk', /\b(desk|workstation|work surface)\b/],
  ['office chair', /\b(office chair|swivel chair)\b/],
  ['dining chairs', /\b(dining chairs|chairs around the table|table with.*chairs|table and.*chairs)\b/],
  ['bar stools', /\bbar stools?\b/],
  ['bathtub', /\b(bathtub|bath\b|freestanding bath)\b/],
  ['shower', /\b(shower|shower enclosure|walk-in shower)\b/],
  ['vanity unit', /\b(vanity|wash basin|sink)\b/],
  ['toilet', /\b(toilet|wc\b)\b/],
  ['television', /\b(television|\btv\b|flat-screen)\b/],
  ['computer', /\b(computer|laptop|pc\b|monitor|imac)\b/],
  ['bookcase', /\b(bookshelf|bookcase|shelving)\b/],
  ['mirror', /\bmirror\b/],
  ['pendant light', /\b(pendant|chandelier)\b/],
  ['fireplace', /\b(fireplace|hearth|log burner)\b/],
  ['rug', /\brug\b/],
  ['garage', /\bgarage\b/],
  ['driveway', /\bdriveway\b/],
  ['lawn', /\blawn\b/],
  ['patio', /\b(patio|decking)\b/],
  ['fence', /\bfence\b/],
  ['solar panels', /\bsolar panels?\b/],
  ['french doors', /\bfrench doors\b/],
  ['bi-fold doors', /\bbi-fold doors?\b/],
 ];
 for (const [name, regex] of candidateObjects) {
  if (regex.test(lower)) objects.push(name);
 }

 // 4. Wallpaper
 let wallpaper: string | null = null;
 if (/\bgeometric\b/.test(lower) && /\b(wallpaper|pattern|wall)\b/.test(lower)) wallpaper = 'Geometric pattern';
 else if (/\bfloral\b/.test(lower) && /\b(wallpaper|pattern|wall)\b/.test(lower)) wallpaper = 'Floral botanical';
 else if (/\b(panell?ing|wood slats?|slatted)\b/.test(lower)) wallpaper = 'Wood paneling';
 else if (/\bfeature wall\b/.test(lower)) wallpaper = 'Feature accent wall';
 else if (/\bmural\b/.test(lower)) wallpaper = 'Scenic mural';
 else if (/\btextured\b/.test(lower) && /\b(wallpaper|wall)\b/.test(lower)) wallpaper = 'Textured neutral';
 else if (/\bwallpaper\b/.test(lower)) wallpaper = 'Patterned wallpaper';

 // 5. Curtains
 let curtains: string | null = null;
 if (/\b(roman blinds?)\b/.test(lower)) curtains = 'Roman blinds';
 else if (/\b(roller blinds?)\b/.test(lower)) curtains = 'Roller blinds';
 else if (/\b(venetian blinds?)\b/.test(lower)) curtains = 'Venetian blinds';
 else if (/\b(shutters?|plantation shutters?)\b/.test(lower)) curtains = 'Wooden shutters';
 else if (/\b(curtains?|drapes?)\b/.test(lower)) curtains = 'Floor-length curtains';
 else if (/\bblinds?\b/.test(lower)) curtains = 'Window blinds';

 // 6. Colours
 const colours: string[] = [];
 const candidateColours: [string, RegExp][] = [
  ['Navy', /\bnavy\b|\bdark blue\b/],
  ['Blue', /\bblue\b|\bteal\b|\bcyan\b/],
  ['Sage green', /\bsage\b|\bolive\b/],
  ['Green', /\bgreen\b|\bemerald\b|\bforest green\b/],
  ['Blush pink', /\bblush\b|\bpink\b|\brose\b/],
  ['Gold / Brass', /\bgold\b|\bbrass\b|\bbronze\b/],
  ['Charcoal', /\bcharcoal\b|\banthracite\b/],
  ['Grey', /\bgrey\b|\bgray\b/],
  ['White', /\bwhite\b|\boff-white\b/],
  ['Cream / Neutral', /\bcream\b|\bbeige\b|\btaupe\b|\bsand\b|\bneutral\b/],
  ['Warm wood / Oak', /\boak\b|\bwalnut\b|\btimber\b|\bwood\b/],
  ['Black', /\bblack\b/],
  ['Mustard / Ochre', /\bmustard\b|\bochre\b|\byellow\b/],
  ['Terracotta', /\bterracotta\b|\brust\b|\bbrick\b/],
 ];
 for (const [name, regex] of candidateColours) {
  if (regex.test(lower)) colours.push(name);
 }

 // 7. Chairs
 const chairs: string[] = [];
 if (/\b(dining chairs?|chairs around the table|table with.*chairs|table and.*chairs)\b/.test(lower)) chairs.push('Dining chairs');
 if (/\b(armchair|accent chair|lounge chair)\b/.test(lower)) chairs.push('Armchair');
 if (/\b(office chair|swivel chair)\b/.test(lower)) chairs.push('Office chair');
 if (/\b(bar stools?)\b/.test(lower)) chairs.push('Bar stools');
 if (/\b(bench)\b/.test(lower)) chairs.push('Bench');
 if (/\b(chaise lounge)\b/.test(lower)) chairs.push('Chaise lounge');

 // 8. Electronics
 const hasTelevision = /\b(television|\btv\b|flat-screen)\b/.test(lower);
 const hasComputer = /\b(computer|laptop|pc\b|monitor|imac)\b/.test(lower);

 return {
  mainCategory,
  subCategory,
  isRoom,
  objects,
  wallpaper,
  curtains,
  colours,
  chairs,
  hasTelevision,
  hasComputer,
 };
}

export async function categoriseBatchWithGemini(
 items: { id: string; room?: string; desc?: string; reason?: string }[],
 apiKey: string,
 model = 'gemini-3.1-flash-lite'
): Promise<Map<string, ImageCategorisation>> {
 const results = new Map<string, ImageCategorisation>();
 const prompt = 'You are an expert interior design classifier. For each property image description, extract structured room details.\n' +
  'Return JSON object with "images" array containing exactly one element for every input item.\n' +
  'Taxonomy:\n' +
  '- mainCategory: One of [Living Room, Dining Room, Kitchen, Bedroom, Bathroom, Toilet, Study & Home Office, Hallway, Exterior, Utility Room, Dressing Room, Home Gym, Media & Games Room, Conservatory, Floorplan, Other]\n' +
  '- subCategory: Specific type: e.g. Double bedroom, Single bedroom, Family bathroom, En suite, Cloakroom / WC, House front, House rear, Garden, Kitchen island, Open-plan kitchen, Formal lounge, Snug / Family room, Dedicated study, Balcony / terrace, Street scene\n' +
  '- Bedroom subCategory must be Double bedroom for double/full/queen/king beds, Single bedroom for single/twin/bunk beds, Nursery for cot-only rooms, or Bedroom (bed size unclear) if size is not stated. Never infer size from master, primary, guest, child, room dimensions or en-suite access.\n' +
  '- objects: String array of visible items (furniture, appliances, fixtures, outdoor features)\n' +
  '- wallpaper: Wallpaper style/pattern (e.g. geometric, floral, textured, feature wall, paneling) or null\n' +
  '- curtains: Window dressing type (e.g. floor-length curtains, roman blinds, roller blinds, shutters) or null\n' +
  '- colours: Array of prominent colours\n' +
  '- chairs: Array of chair types present (e.g. dining chairs, armchair, office chair, bar stools) or empty\n' +
  '- hasTelevision: boolean\n' +
  '- hasComputer: boolean\n\n' +
  'Input items:\n' + JSON.stringify(items);

 const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
   contents: [{ parts: [{ text: prompt }] }],
   generationConfig: {
    temperature: 0,
    responseMimeType: 'application/json',
    responseSchema: {
     type: 'OBJECT',
     properties: {
      images: {
       type: 'ARRAY',
       items: {
        type: 'OBJECT',
        properties: {
         id: { type: 'STRING' },
         mainCategory: { type: 'STRING' },
         subCategory: { type: 'STRING' },
         objects: { type: 'ARRAY', items: { type: 'STRING' } },
         wallpaper: { type: 'STRING' },
         curtains: { type: 'STRING' },
         colours: { type: 'ARRAY', items: { type: 'STRING' } },
         chairs: { type: 'ARRAY', items: { type: 'STRING' } },
         hasTelevision: { type: 'BOOLEAN' },
         hasComputer: { type: 'BOOLEAN' }
        },
        required: ['id', 'mainCategory', 'subCategory', 'objects', 'colours', 'chairs', 'hasTelevision', 'hasComputer']
       }
      }
     },
     required: ['images']
    }
   }
  })
 });

 if (res.ok) {
  const data = await res.json() as any;
  const parsed = JSON.parse(data.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}');
  for (const img of parsed.images ?? []) {
   if (img.id) {
    results.set(img.id, {
     mainCategory: img.mainCategory || 'Other',
     subCategory: img.mainCategory==='Bedroom'?bedroomSubCategory(items.find(i=>i.id===img.id)?.desc,items.find(i=>i.id===img.id)?.room,items.find(i=>i.id===img.id)?.reason,img.subCategory):img.subCategory || img.mainCategory || 'Other',
     isRoom: !isNonRoom(img.subCategory || img.mainCategory),
     objects: Array.isArray(img.objects) ? img.objects : [],
     wallpaper: img.wallpaper && img.wallpaper !== 'null' ? img.wallpaper : null,
     curtains: img.curtains && img.curtains !== 'null' ? img.curtains : null,
     colours: Array.isArray(img.colours) ? img.colours : [],
     chairs: Array.isArray(img.chairs) ? img.chairs : [],
     hasTelevision: !!img.hasTelevision,
     hasComputer: !!img.hasComputer,
    });
   }
  }
 }
 return results;
}

export async function categoriseAllImages(
 images: { id: string; roomType?: string; description?: string; reason?: string }[],
 apiKey?: string,
 options: { useGemini?: boolean; batchSize?: number; onProgress?: (done: number, total: number) => void } = {}
): Promise<Map<string, ImageCategorisation>> {
 const cacheDir = resolve('results/.cache/categorisation');
 if (!existsSync(cacheDir)) await mkdir(cacheDir, { recursive: true });

 const map = new Map<string, ImageCategorisation>();
 const unCached: { id: string; room?: string; desc?: string; reason?: string }[] = [];

 // 1. Load from cache or prepare for processing
 for (const img of images) {
  const cachePath = resolve(cacheDir, `${img.id}.json`);
  if (existsSync(cachePath)) {
   try {
    const data = JSON.parse(await readFile(cachePath, 'utf8')) as ImageCategorisation;
    if (data.isRoom !== undefined) {
     if(data.mainCategory==='Bedroom')data.subCategory=bedroomSubCategory(img.description,img.roomType,img.reason,data.subCategory);
     map.set(img.id, data);
     continue;
    }
   } catch {
    // Ignore corrupt cache
   }
  }
  unCached.push({ id: img.id, room: img.roomType, desc: img.description, reason: img.reason });
 }

 if (options.onProgress) options.onProgress(images.length - unCached.length, images.length);

 // 2. If Gemini is enabled and apiKey present, process in batches
 const batchSize = options.batchSize ?? 20;
 if (options.useGemini && apiKey && unCached.length > 0) {
  for (let i = 0; i < unCached.length; i += batchSize) {
   const batch = unCached.slice(i, i + batchSize);
   try {
    const geminiResults = await categoriseBatchWithGemini(batch, apiKey);
    for (const item of batch) {
     const res = geminiResults.get(item.id) ?? extractBaseCategorisation(item.room, item.desc, item.reason);
     map.set(item.id, res);
     await writeFile(resolve(cacheDir, `${item.id}.json`), JSON.stringify(res, null, 2));
    }
   } catch {
    // Fall back to rule-based extraction for this batch
    for (const item of batch) {
     const res = extractBaseCategorisation(item.room, item.desc, item.reason);
     map.set(item.id, res);
     await writeFile(resolve(cacheDir, `${item.id}.json`), JSON.stringify(res, null, 2));
    }
   }
   if (options.onProgress) options.onProgress(images.length - unCached.length + Math.min(i + batchSize, unCached.length), images.length);
  }
 } else {
  // 3. Fallback extraction for remaining uncached
  for (const item of unCached) {
   const res = extractBaseCategorisation(item.room, item.desc, item.reason);
   map.set(item.id, res);
   await writeFile(resolve(cacheDir, `${item.id}.json`), JSON.stringify(res, null, 2));
  }
  if (options.onProgress) options.onProgress(images.length, images.length);
 }

 return map;
}
