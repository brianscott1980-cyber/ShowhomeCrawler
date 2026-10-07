# Website cache warm-up

`npm run build` runs the warm-up after Next.js builds successfully on Vercel (`VERCEL=1`). Use `npm run build` as the deployment build command so the npm postbuild hook runs.

The warm-up uses the same revision-scoped database caches as page requests:

- Homepage presentation, including map, photos and published counts.
- First 16 unfiltered results for Builders, Developments, Buildings and Interiors, with counts and filter options.
- First 16 unfiltered images for every published interior room-type page and All Room Types, with counts and filter options.

Tasks run sequentially to avoid overwhelming the database. Publishing updated catalogue data invalidates cached results. Existing valid caches are reused on deployment. Personal favourites and location-specific searches are not warmed.

Run `npm run website:warm` to warm manually, including after publishing data. Local builds skip warm-up unless `WARM_WEBSITE_CACHES=true`. Deployment warm-up errors are logged without failing an otherwise successful build; the manual command exits unsuccessfully if any task fails.
