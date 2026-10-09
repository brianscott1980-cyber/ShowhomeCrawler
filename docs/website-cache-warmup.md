# Website cache warm-up

Automatic deployment cache warming is disabled. `npm run build` does not run warm-up, and legacy `--deploy-only` invocations skip it even on Vercel. This lets uncached visits expose database query costs.

The warm-up uses the same revision-scoped database caches as page requests:

- Homepage presentation, including map, photos and published counts.
- Furnishings directory.
- First 16 unfiltered results for Builders, Developments, Buildings and Interiors, with counts and filter options.
- First 16 unfiltered images for every published interior room-type page and All Room Types, with counts and filter options.

Tasks run sequentially to avoid overwhelming the database. Publishing updated catalogue data invalidates cached results. Existing valid caches are reused on deployment. Personal favourites and location-specific searches are not warmed.

Run `npm run website:warm` only when you explicitly want to warm caches. The manual command exits unsuccessfully if any task fails.

Disabling warm-up does not clear existing caches or disable caching during page requests. Cached pages can still be fast after deployment; use a previously unvisited scope or filter combination to inspect an uncached request. Publishing updated catalogue data invalidates revision-scoped caches.
