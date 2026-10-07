# SEO landing pages

Public pages use lowercase, self-canonical URLs on showhomeexplorer.co.uk:

- `/developments/{builder-slug}` — e.g. `/developments/avant`, titled **Avant Developments**.
- `/buildings/{builder-slug}` — e.g. `/buildings/bellway`, titled **Bellway Building Types**.
- `/interiors/{room-slug}/{colour}` — e.g. `/interiors/bedroom/blue`, titled **Blue Bedrooms**.

These are filtered versions of the existing directory/gallery layouts. The server loads the matching first batch, counts and options before rendering. The fixed builder/colour dropdown is hidden. Incoming navigation filters, Reset and later result batches cannot remove the URL's fixed scope; other filters keep the existing session behaviour.

Colour pages match complete colour words in classification labels, including decor, wallpaper and furnishings. For example, Blue matches Blue Decor and Blue Wallpaper. Grey also matches Gray. The supported colour slugs are maintained in `src/web/seo-landing-values.ts`.

Only nonempty builder and room/colour destinations enter the sitemap. Empty combinations return not found. Red Bathrooms, for example, will only be indexed when eligible bathroom images have red classification labels. Individual ready development/building pages and valid room pages remain in the sitemap. Duplicate URLs, unready entries and the previous exhaustive image lists are removed.

Default landing batches are cached until publication. Counts and options remain scoped and cached when cascading is disabled. Publishing invalidates these caches alongside the existing directory caches; the sitemap continues to use Next.js metadata-route caching.
