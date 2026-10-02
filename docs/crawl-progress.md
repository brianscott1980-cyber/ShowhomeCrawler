# Developer crawl progress

Criteria: at least five bedrooms; a visible desk, no visible bed, and no floorplan graphics (explicit v2 checks from Crest Nicholson onward). Developers run in the requested order. From Berkeley onward, ask the user before starting each subsequent developer. Each finished collection is committed and pushed with its matched image assets under `collections/`.

| Order | Developer | Status | Developments checked | Qualifying properties | Unique images | Office matches | Coverage gaps |
|---|---|---|---:|---:|---:|---:|---:|
| 1 | Taylor Wimpey | Completed with gaps; collection included in this commit | 351 | 101 | 855 | 41 | 10 |
| 2 | David Wilson | Completed with gaps; collection included in this commit | 160 | 138 | 724 | 33 | 1 |
| 3 | Miller Homes | Completed; collection included in this commit | 88 | 150 house styles (1,107 plots) | 554 | 29 | 0 |
| 4 | Avant | Completed; collection included in this commit | 43 | 45 | 210 | 7 | 0 |
| 5 | Springfield | Completed; collection included in this commit | 7 | 15 | 33 | 2 | 0 |
| 6 | Persimmon | Completed; collection included in this commit | 234 | 84 | 407 | 19 | 0 |
| 7 | Robertson Homes | Completed; collection included in this commit | 19 | 26 | 248 | 7 | 0 |
| 8 | Redrow | Completed; collection included in this commit | 91 | 71 | 200 | 2 | 0 |
| 9 | The Berkeley Group | Completed with gaps; collection included in this commit | 217 development/phase pages | 12 collected; 3 listings lack details links | 22 | 0 | 4 |
| 10 | Crest Nicholson | Completed; collection included in this commit | 46 | 30 | 156 | 9 | 0 |
| 11 | Lynch Homes | Completed; collection included in this commit | 3 | 0 | 0 | 0 | 0 |
| 12 | Story Homes | Completed; collection included in this commit | 28 | 46 plots | 155 | 9 | 0 |
| 13 | Hill Group | Completed; collection included in this commit | 36 | 16 plots | 210 | 11 | 0 |

Classifier note: Gemini 3.5 Flash-Lite reached its 500-request daily quota during Persimmon. Remaining Persimmon images and subsequent collections use Gemini 3.1 Flash-Lite; image records retain model attribution.

Berkeley coverage: Napier Square has no supported availability table. Three qualifying listings at Eastbrook Village, The Chaplin Collection, and Trent Park link to the homepage rather than a property page; homepage galleries are excluded. Five Fleet area guides are excluded from development discovery. All 22 collected property images were classified; none met the office criteria.

Floorplan criterion update: nine previously published Taylor Wimpey matches were confirmed as floorplan graphics in a visual review and excluded. Its match count is now 41. Earlier photos retain their original classifier results; new crawls use the explicit v2 floorplan checks.

Lynch coverage: all three sitemap development pages checked. Jackton Manor advertises three plots with three or four bedrooms; The Kings and The Kings Phase 4 both explicitly report “Nothing found.” No listings meet the five-bedroom minimum, so no property images were downloaded or classified. The empty collection report is retained and hidden from gateway lists.

Story coverage: all 28 development links in the official directory checked, with 216 advertised plots and 46 meeting the five-bedroom minimum. Ten developments explicitly report coming soon or sold out. All 155 unique property-gallery images classified under the v2 criteria; nine matches visually reviewed and published with their image assets. Temporary classifier 503/429 errors were resolved through batch classification; no pending images or coverage gaps remain.

Hill coverage: all 36 developments in the official public index checked, with 138 advertised plots (including 13 on Marleigh Park’s dedicated site) and 16 qualifying five/six-bedroom plots. Kingsley Park’s second inventory page contributed one qualifying plot. Knights Park, Kew Bridge Rise, The Icon, North Gate Park and Dagenham Green advertise bedroom ranges below five; reserved and coming-soon statuses are checked in each development’s own content, excluding nearby-development recommendations. All 210 unique property-gallery images classified under the v2 criteria; eleven matches visually reviewed and published with their image assets. Temporary classifier errors resolved; no pending images or coverage gaps remain.

Overall: all 13 requested developers processed and published. Earlier documented coverage gaps remain for Taylor Wimpey, David Wilson and The Berkeley Group.
