# Minimum data for a new builder

Use this checklist when adding a builder or reviewing whether its collection is ready to publish. These are onboarding requirements; not every item is currently enforced automatically. Keep incomplete builders in the crawl queue until their publication requirements are met.

## Required builder identity

- A unique, stable lowercase hyphenated slug, display name, and official website URL in `src/adapters/developers.ts`.
- A working discovery entry point: sitemap or development listing, with an adapter that discovers developments and their property galleries.
- A verified logo or a readable name fallback. Record brand colours/name parts in `src/web/builder-brand.ts` when verified assets are available; do not invent branding.
- Record the source URLs, collection date and any discovery gaps in the crawl report. Keep group identity separate from individual trading brands.

## Minimum publishable collection

At least one real development, one identified home/building type, and one usable categorised interior photograph are required for a new builder's inspiration collection. This is a minimum threshold, not permission to stop discovery after finding one example: process all discoverable developments and galleries and record missing coverage.

| Data | Minimum requirement |
| --- | --- |
| Development | Stable key, name, official source URL, builder association and verified region/site location. |
| Geography | Town/address or postcode where available. Obtain coordinates from a reliable development source or postcode lookup; do not substitute the builder's head office. |
| Building type/home | Stable identity, published name or type, development association and source URL. Preserve verified bedrooms, prices and availability when supplied. |
| Image | Downloaded, readable file; stable SHA-256 identity; original source URL; development/property associations; deduplicated without losing associations. |
| Categorisation | Valid website evidence or genuine AI image analysis, with category and provenance. Every collected image must be categorised before an all-image collection is published. |
| Directory totals | Derive builders, developments and building types from the collection. Never enter estimated counts manually. |

Missing coordinates must remain unknown. Such developments may appear in the directory but cannot reliably participate in map or distance searches. Missing prices, bedrooms and availability must also remain unknown, rather than zero or guessed values. A gallery containing only plans, logos or exterior images does not meet the interior-photo threshold.

## HBF ratings and incentives

Check both for every new builder, but neither a rating nor an incentive is required to list it.

- **HBF:** use the official annual HBF award publication. Record stars, award year, source URL and the exact awarded builder/group name. Apply a group award to a brand only when membership is verified, and show the group scope. Never assume five stars from membership, another brand's award, or an older year. If no award is verified, display **Not available**. Current reviewed records live in `src/data/builder-ratings.json`, consumed by `src/web/builder-facts.ts`; retain the exact award identity and verification details in the onboarding record below.
- **Incentives:** use an official builder offer page. Record its URL and verification date; check whether it is current and applies only to selected homes. Show **Selected homes** where applicable. If an offer cannot be verified, display **Not verified** rather than claiming no offers exist.
- **Reviews:** research Trustpilot and the Google main-office listing for every builder. Record verified scores or an explicit unknown outcome; a published rating is not required for listing. Capture each provider's displayed score/average, scale, review count, profile link, scope and verification date. Google uses reviewed web snapshots without a Places API key. Do not treat HBF stars as a public review score. See [builder ratings and Site Rank](builder-ratings.md) for the dataset and sync workflow.

## Processing and publication

1. Discover developments, properties and image galleries. Review coverage and errors.
2. Apply website image categories only from supported, unambiguous source evidence.
3. Run AI categorisation for remaining images, retaining genuine analysis provenance. Unanswered images remain pending; filenames are not classification evidence.
4. Validate the complete report, image files, associations, categories and geography. Review representative images and the resulting builder card, list, development and interior pages.
5. Finalise the collection with the existing pipeline, including `results.json` and development metadata in `locations.json`. Run `npm run typecheck` and relevant adapter/classification checks.
6. Commit and push after each completed pipeline stage. Only mark publication complete after the push succeeds; retain checkpoints and source evidence for resuming.

See [image classification](image-classification.md), [builder branding](builder-brands.md), [directory filters](directory-filters.md) and [recrawl processing](unrestricted-builder-recrawls.md) for implementation details.

## Onboarding record

Store a short record in `docs/<builder-slug>-source-analysis.md`:

```markdown
# <Builder name> onboarding
- Slug:
- Official website and discovery entry point:
- Trading brand / parent group and evidence:
- Verified on:
- Logo/brand source:
- Development / building type / unique image counts:
- Geography coverage and unresolved locations:
- HBF: award name, year, stars, source URL; or no verified award:
- Incentives: source URL, checked date, eligibility; or not verified:
- Discovery/categorisation gaps:
- Gallery / website / AI stage commit IDs:
- Publication checks and outcome:
```

## Logo slide background

Set `logoBackground` in the builder’s `builderBrands` entry (`src/web/builder-brand.ts`). Match the logo artwork’s backdrop independently of the primary text colour; transparent coloured logos can stay on white. The builder ratings sync saves this value in Supabase `builders.logo_background_color`.
