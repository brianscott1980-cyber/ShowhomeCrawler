# Local image classification (Mac, Windows or Linux)

Requires Node.js 22+ and [Ollama](https://ollama.com/download). No Gemini key or paid API is needed. Ollama uses your own hardware; it must be running on the classification computer.

After cloning/pulling this repository:

```sh
npm ci
npm run ai:local:setup
npm run ai:local:sample
```

Setup starts the installed Ollama server if necessary and downloads `qwen3-vl:2b-instruct`. The eight-image sample covers a bedroom, living room, kitchen, bathroom, exterior, floorplan, wallpaper pattern and furnishing texture. It writes an HTML review and JSON progress under `.showhome/local-ai/<model-profile>/`; the terminal prints the exact HTML path. Open it in a browser. It does not change source reports or publish to the website. Earlier categories are comparison references, not verified ground truth.

On a stronger PC, first compare a larger model using the same images:

```sh
npm run ai:local:setup -- --model qwen3-vl:8b-instruct
npm run ai:local:sample -- --model qwen3-vl:8b-instruct
npm run ai:local -- --model qwen3-vl:8b-instruct --builder bellway --limit 100 --include-classified
```

The third command creates a larger review sample without changing classifications on the website. Increase concurrency only after checking memory use and throughput:

```sh
npm run ai:local -- --model qwen3-vl:8b-instruct --concurrency 2 --limit 100
```

To classify outstanding images and **apply** the results to the crawler catalogue:

```sh
npm run ai:local -- --model qwen3-vl:8b-instruct --apply
```

Builders are processed in name order, then developments and building types in order; requests are dispatched in that order even with concurrency. Each local vision request contains one image. Shared image IDs are cached once and reused across every linked house type. Existing classifications are skipped by default. To intentionally replace existing HTML/AI classifications with richer local results, add `--include-classified` (review a sample first).

Optional filters: `--builder bellway --development Landsdale --house-type Avondale --limit 100`. Builder uses the exact slug; development and house-type filters use case-insensitive name substrings. Ctrl+C finishes active requests, saves completed results and exits. Rerun the same command to resume; validated model/version cache entries are reused. Applying holds the builder's crawler lock and refuses a running streaming classifier. Never run two writers against the same collection.

Images are read from the working copy/NAS/offline previews when available. On a PC without the Mac's NAS settings, use an explicitly mounted content root:

```sh
npm run ai:local -- --content-root "Z:\ShowhomeCrawler-content" --model qwen3-vl:8b-instruct --apply
```

If an image is missing, the script attempts its original source URL, then the deployed website asset endpoint, and caches it locally. Unavailable images are marked failed and retried on the next run. This needs internet access for missing images, but AI inference stays local. Git contains catalogue metadata and sample IDs, not original images or model weights.

`LOCAL_AI_MODEL`, `OLLAMA_HOST` and `LOCAL_CONTENT_ROOT` can be set in the shell instead of flags. Default Ollama endpoint: `http://127.0.0.1:11434`; default concurrency: 1. Download/model memory requirements vary; model download size is not total RAM required.

Local caches and HTML reports are deliberately ignored by Git. To resume the same cache on another PC, copy `.showhome/local-ai/` there (or use `--cache-dir` on a writable shared folder, with only one writer). Applied catalogue changes can be committed and pushed; the next machine skips those classified records. Use the repository's existing website import/publication workflow to update Supabase; this command never publishes or writes to Supabase automatically.

The website remains sourced from Supabase; these files are crawler inputs, classification cache and review artifacts. Locally classified images record `categorisationSource: ollama`, model, classification version and the same category/colour/decor/pattern/furnishing metadata used by the site.

Validation status: schema/adapter tests and TypeScript checks passed. The Mac trial was stopped because it made the 8GB laptop unresponsive; the corrected instruct-model configuration has not yet completed an end-to-end trial. Run the sample on the PC before a larger classification job. No sample classifications were applied or published.
