# Gemini image classification

The first run uses Gemini directly on unique gallery images to classify “Home office with no beds”. `GEMINI_MODEL` is configurable; the default is `gemini-3.5-flash-lite`, verified in the live smoke run. Credentials stay in local/server environment variables.

## Contract

A match requires a room staged as a home office or study, a visible desk/work surface for office work, and no visible bed, bunk bed, cot, mattress or unfolded sofa bed. Kitchens, dining rooms, floorplans, exteriors and empty rooms do not match. A bedroom with a desk and any visible bed is excluded. Judge the photo only; do not infer hidden furnishings.

```json
{
  "matches": true,
  "hasDesk": true,
  "hasBed": false,
  "roomType": "home office",
  "description": "A home office with built-in shelving and a desk beneath a window.",
  "reason": "A desk and office chair are visible, with no visible bed."
}
```

The Gemini REST `generateContent` call sends resized JPEG image bytes plus this task's prompt and a JSON response schema. Zod validates the output; contradictory positives, blocked/incomplete responses and invalid JSON are failures. Images are rotated and bounded to 1280 pixels for inference. Original downloaded gallery images are retained locally for review.

## Persistence

Filter bedrooms first, then extract galleries and deduplicate images. Cache results by SHA-256, model and `home-office-no-beds-v1`. Cache false results as well as true. A version change intentionally invalidates the relevant cache. Perceptual reuse uses conservative dHash, aspect ratio and pixel checks to avoid reanalysing the same resized/recompressed photo.

The export records every model answer with each relevant property. `results:persist` stores room type/description and analysis version on globally unique images, plus the complete question-specific boolean result and reason in `image_classifications`. Its unique image/question-version/model key supports repeated persistence without duplicate answers. Future broader searches can add structured tags/descriptions and embeddings; this first run does not perform per-query semantic search.

At most three individual classification calls run concurrently. The resume worker batches up to eight labelled images per call, processes calls sequentially with spacing, and validates that every image ID is answered exactly once. Transient errors are retried with bounded backoff; completed answers are reused. An unavailable model/key/quota leaves pending items, never false results. Model/provider errors are reported without credential-bearing headers or raw responses.

Reference: [Google GenerateContent API](https://ai.google.dev/api/generate-content), [image understanding](https://ai.google.dev/gemini-api/docs/generate-content/image-understanding), [structured output](https://ai.google.dev/gemini-api/docs/generate-content/structured-output).

If an otherwise successful batch repeatedly returns invalid or mismatched image IDs, classification falls back to individual image requests. Each response must still satisfy the same schema and desk/no-bed consistency checks. Any unresolved image remains pending with an explicit error; it is never recorded as a negative result.
