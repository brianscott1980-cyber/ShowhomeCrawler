# Collection card images

Homebuilders show locally stored official logos. `public/logos/sources.json` records the original URLs; when adding a builder, save its logo there and add its source entry. White logos use a dark slide background for contrast.

Homebuilders, Locations, Interiors and Buildings cards receive the images from their own collection. In list layouts a card changes image at the midpoint (50%) of the viewport: next when its bottom edge crosses while scrolling down, previous when its top edge crosses while scrolling up, wrapping at either end. Single-image collections stay still. There is no timer, swipe control or manual carousel on directory cards.

Transitions ease for 700ms; reduced-motion preferences disable the animation. The shared passive scroll listener batches geometry reads with animation frames. Resize, filtering, sorting and layout changes reset crossing baselines. Upcoming images preload only near the viewport.

Card image order is randomised on the server for each page load. Images are shuffled within room types and room types are interleaved, so rooms with many photos do not dominate the beginning of a collection. Duplicate image URLs are removed. Each card uses only its own collection, and scrolling back follows the same random order in reverse. Classified room photos are included for Homebuilders, Locations and Buildings as well as Interiors.

Homebuilder carousels always start with the official builder logo, fitted without cropping on a contrasting background. Randomised room photos follow; the logo stays outside the room shuffle.

When a homebuilder has exterior photos, one is chosen at random as the second slide immediately after its logo. That photo is removed from the remaining shuffled sequence to avoid duplication. Builders without an exterior proceed directly to the mixed room photos.

Grid card rows use their progress through the viewport midpoint instead. Each column owns the centre of an equal progress segment: two columns trigger at 25% and 75%; four at 12.5%, 37.5%, 62.5% and 87.5%. Downward scrolling advances left to right; upward scrolling reverses right to left. Rows and columns come from actual rendered positions, including static cards and incomplete rows, so responsive layouts use their current column count.

Reaching the bottom while scrolling down completes any remaining list or grid card triggers that cannot reach the midpoint. Each advances once; stationary scroll events do not repeat the transition. Scrolling back reverses those completed transitions as the cards return below their trigger.

In the large two-column layout, the first card triggers at 25% and the second at 50% of row progress, bringing the second transition forward. Compact grids keep their evenly spaced triggers.

Buildings start with a randomly chosen front exterior, then a random interior from that building. Front/facade descriptions are preferred; generic exteriors may be used when no front label exists, but rear, garden and aerial photos are not promoted to the front slot. With no suitable exterior, the random interior comes first.
