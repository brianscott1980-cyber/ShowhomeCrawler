# ShowhomeCrawler

Next.js app for exploring UK developer showhome offices, with a deterministic server-side crawler, Gemini gallery classification and local review exports.

## Web app

```sh
npm install
npm run dev
```

Open http://127.0.0.1:3000. Showhome Explorer presents existing Bellway, Cala and Barratt collections under `results/` as decor inspiration. Developer pages include search, development filters, fullscreen image navigation and favourites. Processing status, classification decisions and technical reports are kept out of the browsing pages. The current collection still uses the immediate five-bedroom home-office criteria; user-configurable search criteria are future work. Favourites are stored in your browser; offline HTML favourites from a `file://` origin are not automatically transferred.

Manage collection processing with the CLI commands below. The existing local job API and background worker remain available for operator tooling, with same-origin localhost requests required for writes and one app job at a time. The app uses the existing filename, byte and visual deduplication and caches. Discovery can run without `GEMINI_API_KEY`; add the key to `.env.local` to analyse images.

```sh
npm run build
npm start
```

The app follows the [Next.js App Router](https://nextjs.org/docs/app/getting-started/installation) and requires a local or persistent Node.js host with the source tree, dependencies and writable `results/` storage. Its background crawler is not a serverless/Vercel function. Remote hosting requires an authenticated job service and durable storage before enabling processing controls. No deployment has been configured. CLI commands below remain available; `npm run build:crawler` compiles their TypeScript separately.

Job status is stored in `results/.app-job.json`. If a worker is forcibly terminated, verify that its PID and any crawl/classification children have exited before removing `results/.app-job/` and an affected collection’s `.lock` to recover.

## All-images builder collections

The Builders directory and builder results show categorised rooms and property exteriors, including builders with no office matches. Legacy office-only exports retain their original names for compatibility.

Collect every advertised home without a bedroom filter, deduplicate the gallery images, then classify every unique image and publish the collection:

```sh
npm run crawl -- --builder tulloch-homes --all-images --discover-only --max-developments 1000 --max-properties 10000 --max-images 20000
npm run results:classify -- --folder results/tulloch-homes-home-offices --all-images
npm run results:publish -- --builder tulloch-homes
```

The same workflow supports `scotia-homes`, `david-wilson` and `lynch-homes`. `results:classify-stream` accepts `--all-images` and an optional `--model` to cache answers while collection is running; finish with `results:classify --all-images` to apply them. All-images answers have their own versioned cache and include bedrooms, kitchens, other rooms, exteriors, floorplans and non-room graphics. Categorisation and publication copy all classified images, so a negative office decision never removes a room from the website.

For existing browser-snapshot sources, `--browser-snapshots --live-missing` reuses saved sitemap/robots snapshots and cached pages, fetching missing house pages through the normal bounded HTTP client.

## Setup

Requires Node.js 22 or newer:

```sh
npm ci
cp .env.example .env.local
npm run typecheck
npm test
npm run build
npm run crawl:test
```

Keep credentials in the ignored `.env.local` or environment. `GEMINI_API_KEY` enables classification; `GEMINI_MODEL` defaults to `gemini-3.5-flash-lite`. Database access is optional for local crawling/export. `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are reserved for future API/Storage support. No credential is exposed to the report or browser code.

## Run and review

The requested full run checks every development in Bellway's public development sitemap, filters to five or more bedrooms, and asks whether each unique gallery image shows a home office with a desk and no visible bed:

```sh
npm run crawl -- --builder bellway --min-bedrooms 5 \
  --max-developments 300 --max-properties 2000 --max-images 10000 \
  --output results/bellway-home-offices
```

Open `results/bellway-home-offices/index.html` afterwards. The folder also contains:

- `results.json`: all properties, unique images, positive/negative decisions, coverage, errors and metrics.
- `properties.csv`: all qualifying house-style entries with prices and plots where available.
- `matches.csv`: property/image pairs that matched.
- `images/`: unique downloaded images for review.
- `checkpoint.json`: incremental state, retained on interruption.

These exports and caches are ignored by Git. Explicit local image export is enabled for review even with `STORE_IMAGES=false`; that setting continues to mean no upload to Supabase Storage. No cloud image bucket is used.

For a bounded live check:

```sh
npm run crawl -- --development https://www.bellway.co.uk/new-homes/scotland-west/dargavel-village \
  --max-images 2 --output results/bellway-smoke
```

Add `--discover-only` to download/hash without Gemini. `npm run crawl:test` is an offline fixture parser check. `npm run discover -- --development URL` is the earlier single-development metadata command; `--persist` saves its plots.

The full run applies only the bedroom filter. No minimum price or detached-only restriction is active. An advertised house style may have no currently exposed plot data; the report labels it accordingly. Example gallery photos can be reused across developments and do not establish the exact layout/furnishings of a specific plot. “No beds” means no bed visible in that photograph.

## Limits, deduplication and recovery

Conservative defaults: concurrency 3, request spacing 500 ms, three retries, 15-second page/image timeout. Without explicit flags, crawling defaults to one development, ten house styles and 500 image attempts. CLI hard ceilings bound development/property/image totals, and response byte/image pixel limits bound downloads. The image classifier has at most three simultaneous requests. Same-origin redirects are followed with a three-hop limit; cross-origin and restricted search-route redirects are rejected. Robots search-route restrictions are avoided; sitemap and canonical development/house pages are used.

Page responses, downloaded image bytes and model decisions are cached under `results/.cache`. Re-running the command reuses those cached inputs and skips completed Gemini calls. To fetch a fresh site snapshot, remove only `results/.cache/pages/`; binary and classification caches can remain. Failed model calls are never cached as negative results. Authentication/model errors or an API rate limit stop further individual model calls for that run and leave explicit pending images. Resume only pending decisions in batches of up to eight:

```sh
npm run results:classify -- --folder results/bellway-home-offices
```

The batch worker retries transient failures with backoff and spacing between batches. Individual image IDs, boolean values and consistency are validated before saving each answer. Repeated resume commands reuse cached answers. A run with any failed or omitted work is labelled `completed_with_gaps`.

SHA-256 identifies identical bytes. A conservative dHash comparison plus aspect ratio and thumbnail pixel error detects ordinary resizing/recompression; it can miss crops. Full gallery URL sets identify reused galleries, including reordered galleries. Remaining images are not fetched again for a known complete gallery. Do not equate an entire gallery based only on a shared first image.

Before downloading, each crawl also shares work for the same image filename on the same host and directory, ignoring fragments and known size/quality/format query parameters. Unknown parameters (including crop and source selectors) remain distinct. Concurrent duplicates share one task and failed downloads can be retried. `metrics.reusedImageSources` counts source reuse; properties still link to the shared image. Gallery reuse uses these same source keys and supports duplicate entries. This source shortcut is scoped to the current run; SHA-256 and visual comparison remain the fallback for different filenames.

For full developer runs, use `--discover-only` followed by `npm run results:classify -- --folder RESULTS_FOLDER` to classify the deduplicated images in batches of up to eight rather than making one Gemini request per image.

A per-output lock prevents concurrent runs using the same folder. If an abruptly killed process leaves `.lock`, confirm it has exited before deleting the stale lock. Local caches enable resumable work; remote crawl-item records are a persisted audit of the completed export, not the live queue scheduler.

## Supabase

Project: `hnxrbhlffwmlymxflrdb`, https://hnxrbhlffwmlymxflrdb.supabase.co.

Use `DATABASE_URL` with the transaction-mode IPv4 pooler on port 6543 for runtime queries. Use `DIRECT_URL` with the session-mode pooler on port 5432 for migrations. Replace password placeholders locally; percent-encode special characters. TLS is required and prepared statements are disabled. No credentials from the other project are used for database access.

```sh
npm run db:migrate
npm run results:persist -- --folder results/bellway-home-offices
```

Persistence requires the ShowhomeCrawler project username and stores discovered metadata, galleries, globally unique images, question-specific classifications, property/gallery links, a crawl job and crawl items. Gallery/link writes use transactions; failed persistence is recorded on the job. Binaries remain in the local export, not cloud Storage.

Migrations are under `supabase/migrations`. The runner uses a transaction, advisory lock and checksums in `showhome_internal.migrations`; repeated calls skip applied files. Do not mix this runner with Supabase CLI `db push` on the same database without reconciling migration histories.

Eleven application tables: `builders`, `developments`, `house_types`, `property_listings`, `galleries`, `property_galleries`, `images`, `gallery_images`, `image_classifications`, `crawl_jobs`, `crawl_items`. UUID keys, natural-key uniqueness, foreign keys, status/numeric constraints, timestamp triggers and RLS are included. No browser access policies or vector extension are enabled.

## Classification

Gemini receives images, not webpages. A validated structured response contains `matches`, `hasDesk`, `hasBed`, `hasFloorplan`, `roomType`, `description` and `reason`. Positive matches must have a desk, no visible bed and no floorplan graphics. Local classification identity is image SHA-256 + model + versioned prompt. Positive and negative decisions are persisted; malformed output, refusals and API errors remain failures. Changing the question/prompt requires bumping `analysisVersion`.

The current model and image-input/JSON schema API are documented by [Google](https://ai.google.dev/api/generate-content). See [classification design](docs/image-classification.md) and [Bellway sources](docs/bellway-source-analysis.md).

## Validation

Tests cover configuration and connection routing, source fixtures, plot/price/bedroom parsing, migration/RLS/constraints, SQL upserts and rollback, gallery decoding, development sitemap filtering, image duplicate detection after resize/recompression, queue concurrency, host/download limits and classifier boolean validation. Tests run offline; database checks use PGlite's PostgreSQL engine.

## Cala and the collection gateway

Cala uses the same minimum-five-bedroom and office-with-no-bed criteria. Each developer owns its images, matched HTML, complete coverage report and JSON/CSV exports:

- `results/bellway-home-offices/`
- `results/cala-home-offices/`
- `results/index.html` — gateway to both collections

To discover every currently listed Cala development, download galleries, classify pending images in Gemini batches, persist to the dedicated Supabase project and refresh both reports:

```bash
npm run crawl -- --builder cala --output results/cala-home-offices --max-developments 1000 --max-properties 10000 --max-images 20000 --discover-only
npm run results:classify -- --folder results/cala-home-offices
npm run results:persist -- --folder results/cala-home-offices
npm run results:reports
```

Plot pages are discovered from public cards, including numeric reserved plots without a details link. Empty galleries remain explicit coverage gaps. Open `results/index.html` directly to review the saved collections offline.

## Barratt

Barratt uses the same five-or-more-bedroom and home-office-with-no-visible-bed criteria. Discovery checks its public development sitemap and the currently exposed plot cards, including signed full-size carousel images. Sold-out developments can expose no plot cards.

```sh
npm run crawl -- --builder barratt --output results/barratt-home-offices --max-developments 1000 --max-properties 10000 --max-images 20000 --discover-only
npm run results:classify -- --folder results/barratt-home-offices
npm run results:persist -- --folder results/barratt-home-offices
npm run results:reports
```

The web app and offline gateway include Barratt alongside the existing collections.

## Collections shipped with Git

`collections/<developer>-home-offices/` contains the committed browsing snapshot: JSON data, matched images, HTML and CSV exports. The web app serves this snapshot when present, so developer cards and image galleries work in a fresh checkout. Complete discovery audits, negative images, page caches, checkpoints and credentials stay in ignored local `results/`. The snapshot records the original unique-image total in `metrics.collectedUniqueImages`.

After discovery and classification, publish the current snapshot with:

```sh
npm run results:publish -- --builder taylor-wimpey
```

Commit the developer adapter, registry changes and its entire `collections/` folder together. The publisher checks that classifications are finished and every matched image exists before writing the snapshot.

If the selected classifier reaches its daily quota, resume with an available image-capable model:

```sh
npm run results:classify -- --folder results/persimmon-home-offices --model gemini-3.1-flash-lite
```

Completed decisions are retained. Each image records `analysisModel`, and database classifications use that actual model. Long quota reset delays stop retries instead of repeatedly submitting requests.

Developer directory supports large cards, a compact grid, and a list. The selected layout is stored locally; default sorting shows most matching spaces first. Distance sorting uses straight-line miles to the nearest development with published matches. Users can enter a UK postcode (looked up through [Postcodes.io](https://postcodes.io/docs/overview/)) or explicitly request browser geolocation. Browser coordinates remain in client state; the application does not persist postcode lookups.

Refresh published development location metadata after publishing collections with `npx tsx src/cli/collection-locations.ts`. Metadata is extracted from development pages and their postcode/map data and stored alongside each collection as `locations.json`. Previously resolved locations are reused.
