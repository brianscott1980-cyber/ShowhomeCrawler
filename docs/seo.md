# Search indexing

Canonical site: https://showhomeexplorer.vercel.app/

- `/sitemap.xml` includes the home page and developer collections containing qualifying images, plus their image URLs. Collection modification dates come from their reports.
- `/robots.txt` advertises the sitemap and allows gallery images to be crawled. Operational API endpoints are excluded.
- Developer pages include unique titles, descriptions, canonical URLs, social sharing metadata and CollectionPage/ImageObject structured data.
- Personal favourites, empty collections and downloadable reports have noindex directives.
- The root page includes the Google Search Console HTML verification tag. Keep it in place to retain verification. `GOOGLE_SITE_VERIFICATION` can override the token if ownership changes.

In Google Search Console, use the URL-prefix property `https://showhomeexplorer.vercel.app/`, verify ownership with the HTML tag, and submit `https://showhomeexplorer.vercel.app/sitemap.xml` in Sitemaps. Use URL Inspection to test the home page and request indexing. Google determines when pages are crawled and indexed.
