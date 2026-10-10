# Development research and local area summaries

The scan reads the live Supabase builder, development and building-type registry. It preserves existing contact fields and supplements missing details from each development's published page. Builder office contacts remain separate from development sales contacts.

HBF evidence comes from the latest **annual** survey embedded on the official HBF page. Parent-company/successor ratings retain their recorded scope. Customer scores include source names, dates and counts; unavailable profiles retain their previous verified snapshots. `src/data/builder-reviews-research.json` records the web-retrieved October 10 research, which can include cached profiles.

Map preparation downloads a Geofabrik UK OSM extract onto the local D: storage via the `.showhome` junction, checks the published MD5 and indexes named amenities, national rail stations and motorway junctions. Junctions must belong to a mapped motorway before they receive the motorway label. No NAS access is required. Named ways and relations use their mapped bounding-box centres; distances are approximate straight-line miles, not walking/driving routes.

```powershell
node --import tsx src/cli/build-area-map.ts
node --import tsx src/cli/enrich-developments.ts
```

The classifier's resident `qwen3-vl:8b-instruct` model selects up to four verified amenities within one mile. The summary is constructed solely from those facts. Its selected fact IDs are validated; unsupported model output is rejected. Sparse map coverage produces a review status, and missing coordinates produce a location-review status. Neither is filled with invented amenities, contact details or ratings.

Per-development results are stored at `showhome_web.developments.crawl_metadata.localArea`. The development page reads these directly. Builder ratings are stored in `showhome_web.builders.facts` and the builder directory cards. Existing facts, geography and classifications remain intact.

Local audit files:

- `.showhome/enrichment/inventory.json`: all builders, developments and building types from Supabase.
- `.showhome/enrichment/builders.json`: builder ratings, office information and source availability.
- `.showhome/enrichment/progress.json`: current builder/development, processed counts, contact coverage and unresolved records.
- `.showhome/enrichment/map-progress.json`: local map preparation status.
- `.showhome/enrichment/worker.log`: full scan and retry log.

Use `--contacts-only` to scan contact details independently; `--limit 0 --contacts-only` refreshes builder research alone. `--builder <slug> --limit <number>` validates a sample. `--skip-builders` retains the completed builder research. `--retry` retries failed records from the prior audit. The PowerShell runner retries transient errors after 15 minutes and resumes completed summaries safely.

Data attribution: © OpenStreetMap contributors, ODbL. Source/check dates are available in the development's local area section. Research cannot guarantee every amenity is mapped, or that each development remains available on its builder's website.
