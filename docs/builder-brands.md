# Builder name colours

`src/web/builder-brand.ts` associates every builder with a primary and secondary logo colour and two text parts. Multiword names split at words; single-word names split into readable parts. Monochrome logos use two tonal shades; white marks are represented with dark tones on white cards.

Logo colours stay in the palette. Text colours retain their hue and adjust brightness where needed to reach a 4.5:1 contrast ratio on white cards or the dark builder header. `BuilderName` renders the same palette on the Homebuilders, Locations, Buildings and Interiors directories and group detail pages. The standalone builder header uses the corresponding HTML renderer. Filters and SEO text retain the plain builder name.
