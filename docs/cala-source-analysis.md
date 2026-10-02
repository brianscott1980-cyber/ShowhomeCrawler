# Cala UK sources

Discovery uses Cala's public robots.txt and sitemap.xml. Development keys are the four path components below /homes-for-sale, including Scotland and English regions; plot, site-plan and availability URLs resolve to one development. The initial sitemap contained 80 developments.

Availability pages expose plot cards with numeric data-bedrooms and data-price, house type, reserved state and direct plot-detail links. Five bedrooms or more is the only property filter. Linked reserved plots remain eligible. For reserved cards without a details link, the numeric plot identifier resolves to the public development/plot URL; these pages are also inspected, and inaccessible pages remain explicit errors. Development pages with no linked plots remain in coverage.

Plot galleries use .plot-gallery img, with older galleries using calagallery links. Image URLs are restricted to Cala's own /media/ paths; resize parameters are removed to save original photos. Unrelated logos, floorplans and energy-rating sections are excluded. Empty galleries are explicitly recorded as coverage gaps, never negative classifications. Shared galleries and images are deduplicated before Gemini classification; property associations remain in results.

Results are in results/cala-home-offices, alongside results/bellway-home-offices. results/index.html links both collections. Reports work directly from the filesystem without a web server. Gemini criteria, model/version cache and database persistence are shared with Bellway.
