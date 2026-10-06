# Website catalogue in Supabase

The website catalogue is now stored in the backend-only `showhome_web` PostgreSQL schema in the existing Supabase project. Website routes have no JSON catalogue fallback. Crawl reports remain import/export and recovery artifacts; NAS JSON indexes remain private binary-storage configuration. Image binaries stay on the NAS, with existing offline previews and source-URL fallback.

## Data model

- `builders`: identity, website, logo/background, ratings, office and report status.
- `developments`: builder, original/display names, source URL, town/country, coordinates, contact details and opening hours.
- `buildings`: house-type identities within each builder.
- `galleries`: house type at a development, bedrooms, price and plot metadata.
- `images`: builder-scoped image IDs, source/local paths, content hash and categorisation metadata.
- `gallery_images`: ordered many-to-many image links. Shared house-type photography retains every development relationship.
- `offers`: deduplicated bedroom/price/style combinations advertised at a development, so filters match bedrooms and price on the same offer.
- `directory_cards` and `presentations`: derived database response caches for directories, counters and homepage data. These are generated from normalized records, not report-file blobs.

The existing `public` crawl tables/history are preserved. The serving schema has no anonymous or authenticated browser-role access. The application uses the server-only `DATABASE_URL`, transaction pooling, disabled prepared statements and a maximum of three connections per process. Migrations use `DIRECT_URL`.

Indexes cover builder/name, development/bedrooms/price, building/development relationships, reverse image relationships, category, valid coordinates, directory URLs and name/price ordering. Price bounds are populated in serving cards. A future server-paginated directory can use these indexes without changing the entity model.

## Publication

1. `npm run db:migrate` applies schema migrations.
2. `npm run website:import` imports the latest available reports for all registered builders. Add a slug to import only that builder.
3. `npm run website:publish` rebuilds directory/homepage response caches from database records and atomically replaces them.

Builder finalization and `results:publish` now run both the import and serving-cache refresh automatically. Imports serialize against serving publication and are transactional/idempotent per builder. Failed serving publication leaves the previous directory cache intact. Standalone metadata enrichment or manual report edits require re-import and publication to appear on the website.

`npx tsx scripts/verify-website-import.ts` compares all source image counts, gallery counts and deduplicated links with the database. `npx tsx scripts/check-website-database.ts` prints database totals and checks that no image-less development is published.

## Initial migration verification

38 builders, 2,462 discovered developments, 5,030 building types, 63,135 image records, 18,650 galleries, 196,440 image links and 13,716 distinct offer combinations were imported. Counts/links matched all 38 source catalogues. Only image-ready groups are published: 1,775 development cards and 4,676 building cards. Existing builder-directory readiness rules produce 34 builder cards.

## Performance boundaries

Directory requests read prepared database responses instead of parsing/reconstructing all crawl reports. Individual development/building/interior routes resolve their serving URL and query the corresponding builder/development/building/category records. Asset-source lookup is a single indexed image query. The homepage and individual builder overviews each read a prepared database presentation, including exact full-catalogue counts. Overview carousels send up to 24 diverse previews; full catalogue counts remain server-calculated and full galleries remain available through the directory links.

Directory filtering and the existing More behavior still run in the browser over the prepared card payload. Moving the catalogue into a database does not eliminate that payload size: server pagination/facet endpoints would be a separate frontend change. No claim of server-side pagination is made by this migration.

## Release checks

Production deployment `8563141` returned HTTP 200 without application errors for the homepage, all four directories, Bellway's builder overview and Landsdale's development page. Observed complete response times were 1.43 seconds for builders, 0.75 seconds for Bellway and 2.05 seconds for Landsdale. These are single network measurements, not ongoing performance percentiles. Bellway's response was about 197 KB. Server tracing included no collections/results/private-storage files.

The production build and 57 targeted checks passed, including actual PostgreSQL-engine catalogue reader/schema tests and import parity across all 38 builders. The broader test suite is not fully green: its initial run had older UI fixture failures, including invalid relative image URLs and incomplete browser/map mocks. The database migration does not claim to repair that whole suite.
