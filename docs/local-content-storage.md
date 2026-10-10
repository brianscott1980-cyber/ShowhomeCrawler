# Local content storage

The Windows processing root is `D:\ShowhomeCrawler`. Set `LOCAL_CONTENT_ROOT`
to this directory. Keep `nasBackupEnabled: false` in processing settings and
remove `NAS_BACKUP_ROOT` from the Windows environment.

| Directory | Purpose |
| --- | --- |
| `assets` | Shared original images, addressed by verified SHA-256 and extension |
| `results` | Current builder crawls, checkpoints, page caches and image aliases |
| `collections` | Local copies of publication baseline reports and manifests |
| `.showhome/processing` | Independent Ollama/Gemini snapshots, status and logs |
| `.showhome/supabase-outbox` | Classified images awaiting database reconciliation |
| `.showhome/imported-reports` | Consolidated older workstation reports supplementing current snapshots |
| `.showhome/storage-migration` | Copy log, progress, verified hashes and conflicts |
| `backups/nas-import` | Preserved NAS archive, database dumps and workstation backup provenance |

The repository's `.showhome` and `results` junctions point at D:. With
`LOCAL_CONTENT_ROOT` configured, catalogue and classification readers use the
`collections` copy on D:. Checked-in `collections` files remain deployment
baselines; they are not the Windows processing store.

`scripts/consolidate-local-content.mjs --wait-copy` waits for a successful
Robocopy snapshot before normalising it. Original NAS files are retained.
Canonical image aliases use NTFS hard links on D: to avoid duplicate storage.
Mutable reports are never hard linked. Existing worker results take precedence;
conflicting classifications remain in the snapshot with an audit entry.
Imported classifications are marked pending until Supabase reconciliation verifies
their database presence. No images or database rows are uploaded by this import.

After verification completes, `finish-local-content-migration.ps1` reloads the
running local classification workers so they see imported reports, and releases
a counts-only completion report to main and release/1.0.0. Failed imports stop
before worker reload or release; inspect the issues ledger.

Do not edit or delete the preserved snapshot during verification. Image files
there may share storage with canonical assets; modifying an image in place would
also modify its hard-linked aliases. Treat image bytes as immutable.
