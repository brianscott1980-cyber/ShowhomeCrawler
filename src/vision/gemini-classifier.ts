import { z } from 'zod';
import sharp from 'sharp';
export const question = 'Home office with no beds or floorplan graphics';
export const analysisVersion = 'home-office-no-beds-or-floorplans-v2';
export const verdictSchema = z.object({ matches: z.boolean(), hasDesk: z.boolean(), hasBed: z.boolean(), hasFloorplan: z.boolean().optional(), roomType: z.string(), description: z.string(), reason: z.string() });
export type Verdict = z.infer<typeof verdictSchema>;
export async function classify(bytes: Buffer, apiKey: string, model: string): Promise<Verdict> {
 const image = await sharp(bytes).rotate().resize({ width: 1280, height: 1280, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
 const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
  method: 'POST', signal: AbortSignal.timeout(60000), headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
  body: JSON.stringify({ contents: [{ parts: [
   { text: 'Classify this property gallery photograph. Match ONLY a visible room staged as a home office or study with a visible desk/work surface for office work, AND no visible bed, bunk bed, cot, mattress, or unfolded sofa bed. A bedroom with a desk and any visible bed is NOT a match. Kitchens, dining rooms, floorplans, exteriors and empty rooms are NOT matches. Judge only this image; do not infer unseen furnishings. Reject any floorplan graphic, site plan, schematic or overhead layout drawing, including collages containing one, even if a desk is drawn. Return matches, hasDesk, hasBed, hasFloorplan, roomType, description and reason.' },
   { inlineData: { mimeType: 'image/jpeg', data: image.toString('base64') } }
  ] }], generationConfig: { temperature: 0, responseMimeType: 'application/json', responseSchema: { type: 'OBJECT', properties: { matches: { type: 'BOOLEAN' }, hasDesk: { type: 'BOOLEAN' }, hasBed: { type: 'BOOLEAN' }, hasFloorplan: { type: 'BOOLEAN' }, roomType: { type: 'STRING' }, description: { type: 'STRING' }, reason: { type: 'STRING' } }, required: ['matches', 'hasDesk', 'hasBed', 'hasFloorplan', 'roomType', 'description', 'reason'] } } })
 });
 if (!response.ok) throw new Error(`Gemini HTTP ${response.status}`);
 const body = await response.json() as { candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[] };
 const candidate = body.candidates?.[0];
 if (candidate?.finishReason !== 'STOP') throw new Error('Gemini did not complete classification.');
 const text = candidate.content?.parts?.map(part => part.text ?? '').join('');
 const verdict = verdictSchema.extend({hasFloorplan:z.boolean()}).parse(JSON.parse(text ?? ''));
 if (verdict.matches && (!verdict.hasDesk || verdict.hasBed || verdict.hasFloorplan || /floor[ -]?plan|site plan|schematic/i.test(verdict.roomType))) throw new Error('Contradictory classification.');
 return verdict;
}

export async function classifyBatch(items: { id: string; bytes: Buffer }[], apiKey: string, model: string, allImages = false): Promise<{ id: string; verdict: Verdict }[]> {
 if (!items.length || items.length > 8) throw new Error('Classification batch must contain 1–8 images.');
 const labels = items.map((item, index) => allImages ? `image-${index + 1}` : item.id);
 const parts: ({ text: string } | { inlineData: { mimeType: string; data: string } })[] = [{ text: allImages ? 'Describe and classify EVERY labelled property image independently, including bedrooms, living rooms, kitchens, bathrooms, studies, dining rooms, hallways, utility rooms, exteriors, gardens, floorplans, maps and promotional graphics. Return one answer for each exact imageId. Set matches true for real rooms and property exteriors or gardens; false for floorplans, maps, documents, logos and promotional graphics. Give hasDesk, hasBed, hasFloorplan, a precise roomType, a detailed factual description of furniture, colours and styling, and reason for each image. Do not restrict to offices or exclude beds.' : 'Classify each labelled image independently. Match ONLY a room staged as a home office/study with a visible desk/work surface for office work AND no visible bed, bunk bed, cot, mattress or unfolded sofa bed. Bedrooms with a visible bed, kitchens, dining rooms, floorplans, exteriors and empty rooms do NOT match. Do not let furniture in one image affect another image. Return one answer per supplied imageId, preserving those IDs exactly. Reject any floorplan graphic, site plan, schematic or overhead layout drawing, including collages containing one, even if a desk is drawn. Give matches, hasDesk, hasBed, hasFloorplan, roomType, description and reason for every image.' }];
 for (const [index, item] of items.entries()) {
  const jpeg = await sharp(item.bytes).rotate().resize({ width: 1280, height: 1280, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
  parts.push({ text: 'imageId: ' + labels[index] }, { inlineData: { mimeType: 'image/jpeg', data: jpeg.toString('base64') } });
 }
 const fields = { imageId: { type: 'STRING', enum: labels }, matches: { type: 'BOOLEAN' }, hasDesk: { type: 'BOOLEAN' }, hasBed: { type: 'BOOLEAN' }, hasFloorplan: { type: 'BOOLEAN' }, roomType: { type: 'STRING' }, description: { type: 'STRING' }, reason: { type: 'STRING' } };
 const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
  method: 'POST', signal: AbortSignal.timeout(60000), headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
  body: JSON.stringify({ contents: [{ parts }], generationConfig: { temperature: 0, responseMimeType: 'application/json', responseSchema: { type: 'OBJECT', properties: { images: { type: 'ARRAY', items: { type: 'OBJECT', properties: fields, required: Object.keys(fields) } } }, required: ['images'] } } })
 });
 if (!response.ok) {
  let retrySeconds = response.status === 429 ? 120 : 30;
  const body = await response.json().catch(() => null) as { error?: { details?: { retryDelay?: string; violations?: {quotaMetric?: string; quotaId?: string; quotaValue?: string}[] }[] } } | null;
  for (const detail of body?.error?.details ?? []) if (detail.retryDelay) retrySeconds = Math.max(retrySeconds, Math.ceil(parseFloat(detail.retryDelay)));
  if (response.status === 429) retrySeconds = Math.max(retrySeconds, 120);
  throw Object.assign(new Error(`Gemini HTTP ${response.status}`), { status: response.status, retrySeconds, quotaViolations: body?.error?.details?.flatMap(d => d.violations ?? []) });
 }
 const body = await response.json() as { candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[] };
 const candidate = body.candidates?.[0];
 if (candidate?.finishReason !== 'STOP') throw new Error('Gemini did not complete classification.');
 return validateBatch(JSON.parse(candidate.content?.parts?.map(p => p.text ?? '').join('') ?? ''), labels, allImages).map(answer => ({ ...answer, id: items[labels.indexOf(answer.id)]!.id }));
}
export function validateBatch(body: unknown, ids: string[], allImages = false): { id: string; verdict: Verdict }[] {
 const parsed = z.object({ images: z.array(verdictSchema.extend({ imageId: z.string(), hasFloorplan: z.boolean() })) }).parse(body);
 if (parsed.images.length !== ids.length || new Set(parsed.images.map(i => i.imageId)).size !== ids.length || parsed.images.some(i => !ids.includes(i.imageId))) throw new Error('Batch image identifiers do not match.');
 return parsed.images.map(({ imageId, ...verdict }) => {
  if (!allImages && verdict.matches && (!verdict.hasDesk || verdict.hasBed || verdict.hasFloorplan || /floor[ -]?plan|site plan|schematic/i.test(verdict.roomType))) throw new Error('Contradictory classification.');
  return { id: imageId, verdict };
 });
}
