# Collection card images

Homebuilders show locally stored official logos. `public/logos/sources.json` records the original URLs; when adding a builder, save its logo there and add its source entry. White logos use a dark slide background for contrast.

Homebuilders, Locations, Interiors and Buildings cards receive the images from their own collection. A card changes image at the midpoint (50%) of the viewport: next when its bottom edge crosses while scrolling down, previous when its top edge crosses while scrolling up, wrapping at either end. Single-image collections stay still. There is no timer, swipe control or manual carousel on directory cards.

Transitions ease for 700ms; reduced-motion preferences disable the animation. The shared passive scroll listener batches geometry reads with animation frames. Resize, filtering, sorting and layout changes reset crossing baselines. Upcoming images preload only near the viewport.

Card image order is randomised on the server for each page load. Images are shuffled within room types and room types are interleaved, so rooms with many photos do not dominate the beginning of a collection. Duplicate image URLs are removed. Each card uses only its own collection, and scrolling back follows the same random order in reverse. Classified room photos are included for Homebuilders, Locations and Buildings as well as Interiors.

Homebuilder carousels always start with the official builder logo, fitted without cropping on a contrasting background. Randomised room photos follow; the logo stays outside the room shuffle.
