import type { NextConfig } from 'next';
const config: NextConfig = {
 serverExternalPackages: ['sharp', 'postgres'],
 // The report renderer also runs as compiled Node ESM in the crawler.
 turbopack: { resolveAlias: { './gallery-ui.js': './src/reports/gallery-ui.ts', './home-display.js': './src/reports/home-display.ts' } },
};
export default config;
