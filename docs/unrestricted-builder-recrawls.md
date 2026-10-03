# Unrestricted builder recrawls

All registered builders are recrawled sequentially in their original addition order, beginning with Bellway, Cala and Barratt using fresh development and house pages. Existing published collections remain available until each replacement has completed visual classification and validation.

```sh
npm run crawl -- --builder bellway --all-images --discover-only --refresh-pages --min-bedrooms 1 --max-developments 1000 --max-properties 10000 --max-images 20000
npm run results:classify -- --folder results/bellway-home-offices --all-images --model gemini-3.1-flash-lite
npx tsx src/cli/finalize-builder.ts --builder bellway
```

Repeat for every builder in `builder-recrawl-order.txt`. The order follows the first committed collection for each builder; builders added together retain registry order. Registered builders whose adapters are still uncommitted follow the published builders once their adapter is available. All-images mode bypasses the property filter completely, including bedroom and price requirements, and uses visual classification for every retained image rather than a study-only search. Source and perceptual duplicates are consolidated. `--refresh-pages` bypasses cached page HTML; downloaded image bytes and genuine visual analyses can still be reused. Limits are safeguards rather than selection criteria; verify all omission counters are zero before publishing. Source failures remain recorded in the report.

Compare each new collection with its previous published properties and images; record newly captured URLs, new image IDs, missing previous URLs and source failures in `builder-recrawl-audit.json`. Missing URLs are audit findings, not assumed retired homes. Commit and push each completed collection before starting the next builder. Original local results were backed up to `/tmp/showhome-recrawl-backups` before this run.

After the remaining builders, run a final fresh-page review of Bellway, Cala and Barratt. Reconcile current house galleries, classify any new images, verify omission and pending-analysis counters, rebuild, and publish each reviewed collection separately.

If Gemini quota is exhausted, remaining builders can finish their collection passes in order in separate `results/<builder>-unrestricted-scan-20261003` folders. The publication queue adopts a completed scan after checking identity, image files and omission counters, then classifies and publishes builders in order. Final reviews of Bellway, Cala and Barratt always fetch fresh pages. Existing published collections remain unchanged until validation completes.

Gemini reporting: generated collection reports show the selected model, per-model saved visual-analysis counts and the latest worker status snapshot. Classification workers write `gemini-state.json` beside their report, including quota waits and scheduled retries. There is no automatic Gemini model fallback; `--reuse-model` only permits reuse of existing cached analyses. The optional description categorisation pass can fall back to local extraction, not another Gemini model.

Run `python3 scripts/builder-progress.py` to open the local progress report at http://localhost:8767. This reads collection metadata, genuine analysis caches and available local worker logs; unavailable worker status is shown explicitly.

Operator instruction (3 October 2026): pause after the current builder. The local `results/.cache/recrawl-control.json` records this request. Do not start another builder until the user explicitly resumes the queue. The previous workers were no longer running when the request was received; incomplete collections remain pending and must not be treated as finished or published.

Latest instruction: resume Barratt only, then pause. Gemini quota retries now check every two minutes (rather than thirty minutes), including when the provider suggests waiting until its daily reset. `crawl --resume --all-images --discover-only` continues an interrupted all-images checkpoint, revalidates and reuses downloaded images, and skips previously finished galleries.
