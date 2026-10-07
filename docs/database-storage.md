# Website database storage

Image classification metadata is stored once in `showhome_web.images.metadata`. The compact `gallery_card_index` contains only filter/search fields and a reference to that image. `gallery_cards` is a compatibility view: it assembles a response from the source image and relational galleries only when requested.

`gallery_memberships` is a view over the underlying gallery/image relationships, rather than another copy of house names, development URLs, bedrooms and prices. `gallery_image_links` uses integer gallery and image IDs. The legacy `gallery_images` view preserves existing external keys for imports and callers. Original image IDs, asset URLs, classifications and raw crawler records are retained.

Migrations 009 and 010 are separate committed transactions. Stage 009 releases the large duplicate serving tables before stage 010 rewrites the relationship table. Failed stages roll back individually; rerunning `npm run db:migrate` resumes from the migration ledger. The runner requests a read-write transaction (Supabase's documented cleanup override), takes publication/migration locks and uses a five-second lock timeout.

Before applying a storage migration:

```sh
npm run db:space
npm run db:backup -- --output <new-backup-directory>
npm run db:migrate
npm run db:space
```

The backup is a repeatable-read snapshot of all physical `showhome_web` tables, saved as compressed NDJSON with row counts in `manifest.json`. It is application data, not a complete PostgreSQL cluster dump; schema definitions remain in the migrations. Store backups outside Git, ideally on the NAS. Verify the manifest exists before migrating. The backup command refuses to overwrite existing data files.

Classification JSONB remains useful for flexible tags. Storage is reduced by removing duplicate response JSON and string-heavy relationships, rather than discarding image descriptions or classifications. Review flags and content eligibility should also be persisted alongside this canonical metadata, never decided through image analysis during page rendering.

Applied on 6 October 2026: database size fell from 937 MB to 375 MB. All 63,135 image records, 18,650 galleries, 196,440 image links, 58,611 serving records and 178,083 derived memberships were preserved. The complete image-metadata checksum matched before and after migration, a sampled filtered gallery retained its IDs and totals, and a normal write transaction succeeded. A 53 MB compressed pre-migration snapshot is on the NAS under `ShowhomeCrawler-content/database-backups/2026-10-06-pre-compaction/`.

### Shared gallery query work

Gallery pagination, summary counts and seven cascading facets now share one SQL
statement with materialized scoped-image and house-type relations. Previously,
nine separate statements rebuilt these joins and competed for the three database
connections. Image-only requests retain their lightweight page query.

A live Bellway / Bedroom / four-bedroom request (three preview images) measured
47.4 seconds before and 4.3 seconds after this change. The selected images,
classifications, 929 entries, 799 distinct images, 174 developments and 625
properties matched. These are individual live timings, not a latency guarantee.
An instrumented EXPLAIN ANALYZE run took 13.4 seconds; the remaining largest cost
was constructing the house-type relation, rather than the reused facet queries.
The plan is saved privately in `.showhome/gallery-query-plan.json`.

### Cascading filter switch

`NEXT_PUBLIC_CASCADING_FILTERS=false` keeps dropdown options independent of the
other selected filters. Selected criteria still filter cards and counts normally,
and bedroom/price ranges still enforce a valid minimum and maximum. Selecting a
builder no longer clears the chosen development or building type in this mode.

Cascading is disabled by default. Set the variable to `true` to restore cascading
options. Restart local Next.js after changing it; deployed sites need a rebuild
because this public variable is included in the browser bundle. Directory and
gallery cache keys include the mode so cached options cannot leak between modes.

The same switch also controls numeric summaries. When disabled, directory pages
read published `counts:<kind>` totals instead of aggregating filtered membership
rows. Filtered interior-card count queries are skipped, so card previews retain
their published counts. Galleries cache unfiltered scope totals against the
publication revision and reuse them across filter combinations. Rolodex numbers
stay fixed and render without animation. Pagination still calculates the filtered
result total needed to decide whether another batch is available.
