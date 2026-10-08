# Local classification and publication

Existing image classifications are preserved. New attributes are optional in stored records and required only for new local model responses. Missing attributes never become guessed colour matches.

## Filters

Furnishings lists plain object names. Interior Colours and Furnishing Colours list plain colours. On a Chair furnishing page, its Colours filter matches colours on a structured `chair` furnishing, never curtains or another object in the same image. Selecting a furnishing on a general gallery also scopes Furnishing Colours to that object. Interior Colours includes substantial dominant/secondary fixed surfaces and excludes minor accents. The legacy Colours filter remains available for broad searches outside furnishing pages.

The local classifier stores `interiorColours` (surface, colours, prominence), `furnishings` (object, colours, prominence), model, schema/prompt version, timestamp and processing milliseconds. Model output is validated before saving. The v2 cache is separate from the earlier benchmark cache. The default is `qwen3-vl:8b-instruct`.

## Running future classification

Start Ollama and ensure the NAS is available. Begin with a clean Git checkout on a branch with a configured upstream:

```powershell
npm.cmd run ai:local:publish -- --builder bellway
```

This command skips classified images. It processes builders, developments and building types sequentially, one image request at a time. Shared images belong to the first associated building type. Unlinked images form a final group.

After each development it saves cumulative results, regenerates the builder HTML/CSV reports, imports the builder into Supabase, refreshes website projections, creates a report snapshot, commits those specific files and pushes the current branch's configured upstream. Failures remain retryable. No recursive image assets enter Git.

The local `.showhome/classification-publication.json` checkpoint records database publication, commit and push phases. If publication or push fails, the run stops before the next development. Rerunning retries that phase first. The publisher fetches before committing and fetches again before pushing, rebasing onto its upstream when remote commits are missing locally; a conflict stops publication for review. Classification responses are individually cached, so resuming does not repeat completed inference. Ctrl+C drains active requests and saves progress without publishing a partly processed development.

Normal `ai:local` remains a review command; `--apply` writes local results without publishing. Publishing disallows samples, reclassification and parallel inference. This implementation does not start the crawler or an existing-image reclassification sweep.

## Owner report

`/classifications` is linked only for owner UUID `d7428368-8355-4417-b0e7-2059f97e2bd2`. The API verifies the bearer token through Supabase `getUser` and checks that UUID before reading reports. Responses are private and uncached. No report data is embedded in the public page.

Snapshots in `classification-reports/` are committed and explicitly included in the report API's deployment file tracing. Initial snapshots describe the existing catalogue; they do not assert that its database publication was verified. `npm.cmd run classifications:reports` regenerates these without model calls.

The page shows an overall summary and checks every 15 seconds. Image crawling and classification have independent activity cards, current builders, active developments and counters. Select a builder for its development summary. Historical captured galleries are labelled Existing catalogue because old reports did not track download completion independently. It shows completed/failed/pending counts and classification method/colour coverage summaries. It does not render all image cards. `VERCEL_GIT_COMMIT_SHA` identifies the deployment. Updates appear after Git-triggered deployment finishes. Git push success and Supabase publication are distinct from successful deployment; a provider build failure must be resolved before new snapshots become visible.

## Independent live progress

Crawl, local classification, Gemini resume and Gemini streaming workers publish compact progress into separate `showhome_web.presentations` keys: `pipeline:crawl:<builder>` and `pipeline:classification:<builder>`. Updates are throttled to 15 seconds, with forced updates at boundaries. The protected API verifies the owner before querying these keys. Git/deployment snapshots in `pipeline-reports/` are the fallback; frequent local worker state lives in ignored `.showhome/pipeline-progress/`, so independent workers do not dirty the tracked checkout during processing. Database progress failures preserve local progress and log a warning. New gallery statuses track downloads rather than development-page discovery. Counts are unique per builder and per development; shared images can belong to multiple developments. Classification totals cover images collected so far and can grow while crawling continues. An overdue running update is flagged rather than assumed stopped. No workers or reclassification sweeps are started by changing the report.

## Continuous Windows processing

`npm.cmd run process:local` starts one sequential builder crawler and one sequential Ollama classification worker. Collection can advance to the next builder while classification processes the previous completed builder. The runner refreshes gallery pages, carries existing classifications forward and classifies only unclassified images. New originals are written directly to the configured NAS assets folder. It publishes and pushes results, including crawl/classification summary snapshots; existing-only refreshes are also published. State and per-builder logs are in `.showhome/processing/`. Rerunning resumes saved state and cached inference. Source failures are recorded and other builders continue; unresolved publication failures stop advancement.
