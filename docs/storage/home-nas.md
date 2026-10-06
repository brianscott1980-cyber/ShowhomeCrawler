# Home NAS detection

`npm run storage:status` verifies the configured network volume and reports its current availability. `npm run storage:connect` also attempts a noninteractive SMB reconnection using credentials previously saved by macOS. No passwords are stored in this repository.

Private configuration lives in `.showhome/storage-config.json` (ignored by Git). It contains the configured home SSIDs, server/share, account name, storage directory and a unique storage identity. The NAS directory carries the matching `.showhome-storage.json` marker.

A mounted directory is accepted only when the mount table identifies the configured server and share, the marker matches, and a bounded read/write probe succeeds. If macOS exposes the SSID, an unrecognised network selects local mode. If macOS hides it, a verified NAS mount supplies the home-storage signal. Checks time out rather than blocking development on an unreachable share.

The local LaunchAgent `uk.showhome.storage-detection` checks every 30 seconds and at login. Its configuration belongs to the local machine, not Git. Current status is written atomically to `.showhome/storage-status.json`.

Detection does not migrate assets or redirect the application yet: `migrationComplete` remains false. Existing local crawl files remain intact. The next storage-layer migration will use this health signal to choose NAS assets or local offline previews/catalogue.

To stop automatic checking: `launchctl bootout gui/$(id -u)/uk.showhome.storage-detection`.

## Asset migration (awaiting explicit approval)

The storage reader serves local originals first, verified NAS originals second, and local WebP previews when offline. AI workers never substitute previews for full-resolution originals. The raw-download index records NAS-only assets so disconnected crawls do not download them again.

`scripts/migrate-nas-content.py` archives cached HTML and moves deduplicated image assets, retaining catalogue JSON and saved AI analyses locally. Every NAS copy is flushed and checked with SHA-256 before the local original is removed. All hard-link aliases are grouped; originals are removed only after local previews and the download index have been saved. Migration is resumable, with progress in `.showhome/migration-progress.json`.

Migration is gated: no content is moved unless the command explicitly receives `--confirmed` or private configuration has `migrationApproved: true`. Background crawl jobs require this private approval flag too. The flag is currently false; no migration has started.
