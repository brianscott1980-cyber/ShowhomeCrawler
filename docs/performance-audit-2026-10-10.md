# Site performance review — 10 October 2026

The largest remaining bottleneck is uncached room-gallery filter/count computation. Main directories and the sampled building results are substantially faster.

## Method

Browsed the production site in Chrome on desktop: homepage, all five directories, AJC overview, Abbey Grange overview, Aberdour building gallery, Bedroom gallery, and Armchair gallery. Scrolled directories into later batches and scrolled galleries into additional results. Measured production HTML and pagination/filter API responses twice sequentially. These are complete response times, excluding browser rendering and image downloads; first observed requests are not guaranteed cache misses.

Separately ran the current gallery code against the configured database with application result, facet and count caches bypassed and cache writes suppressed. These expose query costs, but do not clear PostgreSQL/OS caches or reproduce every Vercel/browser overhead. Single samples vary with database load. No production caches were cleared.

## Directory HTML response times

| Directory | First observed | Repeat | Response size |
|---|---:|---:|---:|
| / | 0.38s | 0.28s | 619 KiB |
| /builders | 0.17s | 0.18s | 296 KiB |
| /developments | 0.25s | 0.27s | 471 KiB |
| /buildings | 0.16s | 0.16s | 142 KiB |
| /interiors | 0.22s | 0.18s | 399 KiB |
| /furnishings | 0.15s | 0.15s | 130 KiB |

## Results and overview HTML response times

| Page | First observed | Repeat |
|---|---:|---:|
| /builders/ajc-homes | 0.32s | 0.17s |
| /builders/barratt | 1.82s | 0.33s |
| /developments/abbey-grange | 0.26s | 0.19s |
| /developments/a-beautiful-life-by-the-broads | 0.25s | 0.18s |
| /buildings/redrow/abbeywood | 0.48s | 0.14s |
| /buildings/lovell/aberdour | 0.35s | 0.14s |
| /interiors/bathroom | 0.23s | 0.23s |
| /interiors/bedroom | 0.34s | 0.27s |
| /interiors/ajc-homes | 0.15s | 0.18s |
| /furnishings/arched%20wall%20panel | 0.20s | 0.12s |
| /furnishings/appliances | 0.42s | 0.14s |

AJC `/interiors/ajc-homes` is a directory landing, not a gallery scope. An exploratory API request with that URL as a gallery scope was invalid and is excluded from pagination findings. The actual page returned HTTP 200.

## Pagination and filter API response times

| Request | First observed | Repeat |
|---|---:|---:|
| developments offset 48 | 0.80s | 0.30s |
| buildings offset 48 | 0.28s | 0.16s |
| developments 3+ beds | 0.51s | 0.18s |
| Bedroom offset 32 | 0.39s | 0.16s |
| Bathroom offset 32 | 0.54s | 0.16s |
| Bedroom blue search | 0.35s | 0.26s |
| Aberdour offset 16 | 0.15s | 0.10s |

All valid sampled page/API requests returned HTTP 200. Bedroom text search bypasses gallery-result caching; its repeat response was 0.26s.

## Gallery queries with application caches bypassed

| Gallery | Combined page/filter statement | Separate full-count statement | Total call |
|---|---:|---:|---:|
| All Room Types | 11.21s | 7.31s | **18.83s** |
| Bedroom | 4.27s | 2.74s | **7.37s** |
| Bathroom | 4.02s | 1.14s | **5.83s** |
| Armchair | 1.90s | 0.30s | **2.35s** |
| Aberdour building type | 0.30s | 0.08s | **0.59s** |

The room/gallery query constructs complete scoped image/home relations and filter options before serving 16 cards. On a cold count cache, a separate statement rebuilds these relations for stable counts. Tag and colour facets expand classification JSON during requests. Timings establish where the cost sits; execution plans are still needed to attribute individual join/JSON operations.

## Scrolling and images

- Builders reached all 34 cards; Developments, Buildings and Furnishings loaded subsequent 16-card batches; Interiors revealed all room cards. No persistent scrolling failure was observed.
- Aberdour loaded all 21 gallery cards. Bedroom and Armchair appended more results. Fresh cards briefly displayed loading marks; observed thumbnails subsequently settled. No browser error/warning logs were captured on the final gallery. This is a spot check, not a frame-rate measurement.
- Three sampled image downloads completed in 0.21–0.34s here. Each redirected from the site asset endpoint to an external original image host. Sizes were approximately 330 KiB, 417 KiB and **1.47 MiB**. Thumbnail-sized assets would reduce transfer and decoding costs on slower devices/networks.
- Some responses are large: Bedroom HTML about 698 KiB, homepage 619 KiB, Developments HTML 471 KiB, and a 16-card development API batch 372 KiB (uncompressed transferred bytes in these curl requests). Payload trimming is a secondary opportunity.

## Priority

1. Prepare independent room-gallery facets and stable counts during publication, rather than computing them on a visitor’s first request. Deployment cache warming remains disabled.
2. Inspect All Room Types/Bedroom plans and avoid rebuilding image-to-home relations in the separate count query. Add targeted indexed projections only where the plan demonstrates a need.
3. Serve appropriately sized thumbnails, reducing reliance on large external originals.
4. Trim rich directory/gallery payloads; investigate Barratt overview’s first observed 1.82s response if it remains reproducibly slow.

No performance implementation changes were made during this review.
