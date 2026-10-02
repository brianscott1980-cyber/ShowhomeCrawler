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
| 11 | Lynch Homes | Queued | | | | | |
| 12 | Story Homes | Queued | | | | | |
| 13 | Hill Group | Queued | | | | | |

Classifier note: Gemini 3.5 Flash-Lite reached its 500-request daily quota during Persimmon. Remaining Persimmon images and subsequent collections use Gemini 3.1 Flash-Lite; image records retain model attribution.

Berkeley coverage: Napier Square has no supported availability table. Three qualifying listings at Eastbrook Village, The Chaplin Collection, and Trent Park link to the homepage rather than a property page; homepage galleries are excluded. Five Fleet area guides are excluded from development discovery. All 22 collected property images were classified; none met the office criteria.

Floorplan criterion update: nine previously published Taylor Wimpey matches were confirmed as floorplan graphics in a visual review and excluded. Its match count is now 41. Earlier photos retain their original classifier results; new crawls use the explicit v2 floorplan checks.
