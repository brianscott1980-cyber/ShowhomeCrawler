# Collection card images

Homebuilders show locally stored official logos. `public/logos/sources.json` records the original URLs; when adding a builder, save its logo there and add its source entry. White logos have a dark plaque for contrast.

Homebuilders, Locations, Interiors and Buildings cards receive the images from their own collection. A card changes image when its top crosses 25% of the viewport height: next while scrolling down, previous while scrolling up, wrapping at either end. Single-image collections stay still. There is no timer, swipe control or manual carousel on directory cards.

Transitions ease for 700ms; reduced-motion preferences disable the animation. The shared passive scroll listener batches geometry reads with animation frames. Resize, filtering, sorting and layout changes reset crossing baselines. Upcoming images preload only near the viewport.
