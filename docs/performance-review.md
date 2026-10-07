# Performance review — 7 October 2026

Implemented:

- Development overview reads run concurrently. Offer queries are limited to the development URLs being displayed instead of returning every offer for that builder.
- Builder presentation reads use React request memoization, allowing metadata and the page to share one database read and classification pass.
- Collection reads exclude images marked ineligible in SQL, avoiding transfer and processing of those records.
- Development routing stores compact pairs rather than three overlapping indexes. Its serialized database payload falls from 447,507 to 105,886 bytes (76% smaller). A warm server process reuses the expanded index; each request still checks the publication revision and immediately refreshes after publication.
- Gallery hero images and builder/development navigation photos use responsive Next image delivery. The visible hero has eager loading and high fetch priority; navigation photos remain lazy. Fullscreen images retain their original source.
- Main-menu links stop automatically prefetching unrelated routes, reducing background requests on initial page loads.

Validation used the local Next development server, not a production build. Warm request completion samples were approximately 0.30–0.32 seconds for Bellway and 0.70–0.98 seconds for Landsdale. An earlier single Landsdale sample was 3.55 seconds; varying database/network load means this is indicative rather than a controlled speedup measurement. All representative homepage, directory, builder, development, room and room-colour requests returned 200 after the changes.

Remaining opportunities:

- The homepage's published map points and photo metadata account for about 507 KB before HTML/RSC wrapping. Fetching this data only when the map becomes visible could reduce initial network transfer, at the cost of an additional map request.
- Large building/development/feature option lists still travel with directory and gallery responses. Separating static option data from result batches could reduce repeated filter-response payloads.
- Cold room-colour queries still join classification JSON. A compact indexed image-to-feature relation would improve these cold queries and the colour sitemap scan; it needs a database migration and publication updates.

Development HTML includes Next debugging information. Compare production response bytes and browser paint metrics before attributing production improvements to these local timings.
