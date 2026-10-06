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
