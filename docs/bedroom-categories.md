# Bedroom categories

Bedrooms describe bed size rather than room size, occupancy or en-suite access. Double, full, queen, king and super-king beds map to `Double bedroom`; single, twin and bunk beds map to `Single bedroom`. When both sizes are present, the double bed takes precedence. Cot-only rooms are `Nursery`. Descriptions without bed-size evidence remain `Bedroom (bed size unclear)`.

Both rule-based extraction and Gemini categorisation use these labels. Older cached bedroom labels are normalised on read, so a master/guest/child label cannot override explicit bed-size evidence.

Run `npm run images:normalise-bedrooms` to update existing collection reports, crawl reports and cached categorisations using their saved image descriptions. It preserves other categorisation fields and performs no new image-analysis requests.
