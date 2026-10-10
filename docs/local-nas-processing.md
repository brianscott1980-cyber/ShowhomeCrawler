# Local processing and NAS access

## Current local drive configuration

`LOCAL_CONTENT_ROOT` is `D:\ShowhomeCrawler`. New original images are saved in
`D:\ShowhomeCrawler\assets`. Workspace `.showhome` and `results` are directory
junctions to the corresponding directories on D:, so logs, classifications,
pending uploads, crawler reports and caches live on D: without changing their
workspace paths. Original C: directories are retained as `*-before-d` migration
backups and excluded locally from Git.

Automatic NAS backups are disabled by `nasBackupEnabled:false` in processing
settings. `NAS_BACKUP_ROOT` retains the previous NAS location for later copying
and for fetching existing images that have not yet been staged locally. A NAS
cache miss is copied into local `assets`, verified by SHA-256, and used locally
afterwards. This is local primary processing, not a fully disconnected mode.
The image cache pruning worker is inactive while automatic backups are disabled.

To explicitly back up classification results later, run
`node --import tsx src/cli/sync-nas-results.ts`. This copies classification
outbox batches; new local original images require a separate later copy of
`assets` to the NAS. Neither operation confirms a Supabase upload.

Crawling, Ollama, Gemini and the classification backup worker use one filesystem
lock at `.showhome/processing/nas-access.lock`. NAS operations run one at a time
with a 150 ms interval. Dead process locks are reclaimed automatically.

Original image bytes are cached in `.showhome/ssd-cache/<sha256>.bin`. Every
cache read verifies the content hash. Image identity metadata (dimensions,
perceptual hash and thumbnail) is cached alongside the bytes. Subsequent crawl
verification uses the SSD instead of reading the NAS again. The backup worker
prunes the oldest image files every five minutes to approximately 8 GiB;
identity metadata is retained. Evicted images can be fetched again as needed.

Classifications remain in the local processing folders and
`.showhome/supabase-outbox`. `src/cli/sync-nas-results.ts` copies new or changed
outbox entries to `<LOCAL_CONTENT_ROOT>/classification-backups/<builder>/` in
immutable JSON batches of up to 500 results. It checks every five minutes and
records successful copies in `.showhome/processing/nas-result-sync.json`.
Unavailable NAS storage is retried without deleting local results or marking
them as confirmed in Supabase. The first sweep backs up existing local results.

The processing supervisor starts the backup worker automatically. The standalone
command is `node --import tsx src/cli/sync-nas-results.ts`. Its single-process lock
prevents duplicate workers. Backup files contain the original outbox payload,
including model provenance and linked properties; no database writes or Git
publishing are involved. NAS backups accumulate and are not automatically deleted.
