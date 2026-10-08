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

The local `.showhome/classification-publication.json` checkpoint records database publication, commit and push phases. If publication or push fails, the run stops before the next development. Rerunning retries that phase first. Classification responses are individually cached, so resuming does not repeat completed inference. Ctrl+C drains active requests and saves progress without publishing a partly processed development.

Normal `ai:local` remains a review command; `--apply` writes local results without publishing. Publishing disallows samples, reclassification and parallel inference. This implementation does not start the crawler or an existing-image reclassification sweep.

## Owner report

`/classifications` is linked only for owner UUID `d7428368-8355-4417-b0e7-2059f97e2bd2`. The API verifies the bearer token through Supabase `getUser` and checks that UUID before reading reports. Responses are private and uncached. No report data is embedded in the public page.

Snapshots in `classification-reports/` are committed and explicitly included in the report API's deployment file tracing. Initial snapshots describe the existing catalogue; they do not assert that its database publication was verified. `npm.cmd run classifications:reports` regenerates these without model calls.

The page loads one builder at a time and checks every 15 seconds. It shows groups, completed/failed/pending counts, previews, model provenance and structured attributes. `VERCEL_GIT_COMMIT_SHA` identifies the deployment. Updates appear after Git-triggered deployment finishes. Git push success and Supabase publication are distinct from successful deployment; a provider build failure must be resolved before new snapshots become visible.
