import {copyFile, mkdir} from 'node:fs/promises';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
// MapLibre v6 workers import a shared sibling module. Serve both unchanged
// from the installed package: Next's asset bundling cannot preserve that pair.
const source=dirname(fileURLToPath(import.meta.resolve('maplibre-gl')));
const destination=fileURLToPath(new URL('../public/maps/worker/',import.meta.url));
await mkdir(destination,{recursive:true});
for(const filename of ['maplibre-gl-worker.mjs','maplibre-gl-shared.mjs'])await copyFile(join(source,filename),join(destination,filename));
