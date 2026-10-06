# Rendering performance

The homepage previously calculated its map, group counts, featured photos and image-to-house relationships on every request. Grouping repeatedly scanned all properties for each image. Directory carousel props also included full image lists, and filter rows repeated the same development/bedroom combinations.

The build now produces `.generated/homepage.json` from the available catalogue. Production reads this snapshot; development continues to read current catalogue files. A new deployment rebuilds the snapshot. The generated file is explicitly included in server tracing. Private `.showhome` files, offline previews, original image folders and crawl results are excluded from deployed functions.

Grouping indexes images to properties once. Homepage photo-to-development associations are indexed once. Collection folder selection caches only status/time metadata and invalidates it when report file timestamps or sizes change.

Directory carousels receive up to 12 previews. Detail galleries retain all images. Directory count identifiers use shared short tokens; equivalent location/bedroom rows merge their image identities. These changes retain filter choices and exact unique-image counts. The map's initial props omit carousel and property arrays; the filter provider supplies updated matching cards after hydration.

Card and homepage preview photos use Next Image with responsive sizes. Next's internal image optimizer requires an image body, so `?optimize=1` on the validated asset route returns source bytes when originals are not bundled. Original-image URLs retain their source redirects. Optimized fetches have a 15-second timeout and a 20 MiB size check. A route loading boundary streams the header and loading state while directory data is prepared.

## Verification on 6 October 2026

Local production build on the development laptop, using its full catalogue, one request per route in the order shown. Times are not production Vercel measurements or browser FCP/LCP measurements. Response sizes are uncompressed HTML including React Server Component data.

| Page | First byte | Complete response | Response size |
| --- | ---: | ---: | ---: |
| Homepage | 0.070 s | 0.127 s | 0.85 MiB |
| Builders | 0.354 s | 1.508 s | 1.32 MiB |
| Developments | 0.014 s | 1.103 s | 7.70 MiB |
| Interiors | 0.011 s | 1.761 s | 6.73 MiB |
| Buildings | 0.011 s | 1.470 s | 17.16 MiB |

The homepage snapshot read alone measured about 6 ms. A 640-pixel image returned HTTP 200 as WebP (36,916 bytes). Production builds and 22 focused tests passed. Browser checks confirmed the homepage and the development directory's loading state, filters and results render. Server trace checks confirmed the snapshot is included and private NAS data is excluded.

The deployed homepage baseline sampled before these changes took about 17.7 seconds to first byte; this is a different environment and is not a controlled before/after comparison. Initial local directory responses were roughly 10.6–42.0 MiB before payload reductions. The buildings directory still has a substantial complete-catalogue payload. A future improvement is fetching additional card data in batches while preserving global filter facets and counts, rather than sending every card in the initial response.
