# Builder ratings and Site Rank

`src/data/builder-ratings.json` covers every registered builder. The 4 October 2026 research matched 21 HBF awards and 31 Trustpilot profiles across 37 builders. Google Maps main-office snapshots were verified for 27 builders; 10 remain explicitly unverified. Trustpilot values are dated snapshots retrieved through the web tool and may reflect cached source pages. Robertson's snapshot came from the Trustpilot search index because direct retrieval was unavailable. Missing matches remain unknown. Small review samples are retained with their actual count.

## Supabase

`builders` holds HBF stars, the published `hbf_composite_score`, award year/name/source, verification date, and `site_rank`. Builder cards and list views show the composite satisfaction score rounded to the nearest 0.5, using a half house for half points. This is distinct from the official star award; the raw composite score and source remain available in the tooltip and evidence. Unknown composite scores remain unavailable. Existing Trustpilot summary columns are retained for compatibility. `builder_review_sources` holds each provider's rating, average rating, review count, profile link/name, scope, status, date and evidence. Trustpilot's numerical TrustScore is its average-rating input; `rating` mirrors the source score for convenience. Google uses the verified main-office listing, not a mixture of development reviews. Unverified records have null scores and counts and do not contribute to ranking.

The [unrated-builder recheck](hbf-rating-recheck.md) covers all 16 unresolved builders, HBF directory identity checks and historical results. Directory membership is not a star rating; no additional current awards were verified. Per-builder audit evidence is retained in Supabase.

HBF ratings use the [official 2026 award list](https://www.hbf.co.uk/documents/15516/HBF_CSS_and_Star_ratings_2026_brochure_4.pdf). This is a five-star award list, not a league table; absence does not prove a lower rating. Barratt/Redrow/David Wilson and Vistry brands retain their group award scope and relationship evidence. The Larkfleet record points to its verified successor Allison Homes; its current award and Trustpilot profile are explicitly labelled as Allison, rather than historical Larkfleet ratings.

`site_rank` is our ranking, recomputed by `refresh_builder_site_ranks()`:

1. HBF stars descending; unknown HBF comes after verified ratings.
2. Total verified review count across Trustpilot and Google descending.
3. Combined review-count-weighted average descending: `sum(provider average × provider count) / sum(provider count)`.

Builders with identical metrics share a dense rank. Different provider averages are not simply added. A missing provider contributes neither a zero rating nor a review count. This ordering deliberately prioritises review volume over average score, as requested. Scores describe different review populations and can include overlapping reviewers.

## Updating

- `npm run db:migrate` applies the schema changes.
- `npm run builders:ratings:sync` imports the reviewed HBF, Trustpilot and Google snapshots, adds missing registry builders, and recomputes ranks. It preserves newer provider records.
- `npm run builders:ratings:crawl` attempts to refresh verified Trustpilot links from profile structured data. A failed fetch retains the previous verified snapshot and its collection date.
- `npm run builders:ratings:crawl -- --google` imports the reviewed Google web snapshots and recomputes Site Rank. This command does not perform a new search or advance the research date.

HBF's annual publication currently requires a reviewed dataset update, including confirming its year and exact award/group identities. Google also requires a fresh reviewed web research pass. Direct Trustpilot collection was blocked for all 31 profiles in this session, so the reviewed web snapshots were retained. The gallery/image crawler remains paused independently.

## Google web snapshot research

No Google Places API or API key is required. `src/data/builder-google-reviews.json` records every builder's research outcome on 4 October 2026. Verified entries contain the displayed Google rating, exact review count, listing name, office address, Google Maps link, official identity evidence and date. Both `rating` and `average_rating` store Google's displayed average out of five. The date records when the listing was inspected, not the date of the latest review.

For each refresh:

1. Find the builder's main office on its official contact page.
2. Search Google Maps for that office and inspect the actual listing. Match the office address and website or phone; do not use a development or a similarly named company.
3. Capture the rating and exact total count from the same listing, along with its name, address and link. Add the official identity source and the actual inspection date. Do not import individual reviews or reviewer details.
4. Keep missing, ambiguous and no-review listings unverified with null scores/counts and a reason. Do not substitute a regional office or automatically inherit a parent-group score.
5. Run `npm run builders:ratings:crawl -- --google` or the full ratings sync to persist the reviewed snapshots and refresh Site Rank.

The import validates complete registry coverage and requires a positive count and Google Maps link for every verified score. A single `main-office` provider key per builder prevents counting successive office snapshots twice. Newer database snapshots are preserved.

Scope is retained in the evidence notes. Barratt uses its named group support centre; Cala uses its Scotland group office; Morris shares its head office with its North division; Harron's new head office shares its Yorkshire functions. Redrow's named head-office listing is now a group support office. Hopkins' listing has been renamed untypical Anglia but matches its official registered office and website. Larkfleet uses its verified successor Allison. These are office-specific review populations, not national builder averages.

The 10 unresolved builders are David Wilson, Persimmon, Lynch, Bovis, Linden, Countryside, Wain, Maguires, AJC and Hayhill. Their reasons and research links are in the dataset. AJC's brand office has no reviews. Development and regional-office scores found during research were excluded. Anwyl's building/street/phone match but Google and the official site show different postcodes; this discrepancy is retained in its evidence note.
