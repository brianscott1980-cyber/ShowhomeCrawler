import type { NextConfig } from 'next';
const config: NextConfig = {
 images: { localPatterns: [{pathname:'/api/assets/**',search:'?optimize=1'},{pathname:'/logos/**',search:''}] },
 // Images use the asset route's existing source redirect when not bundled.
 outputFileTracingExcludes: { '/*': ['./collections/*/images/**/*', './results/**/*', './.showhome/**/*', './.git/**/*'] },
 outputFileTracingIncludes: { '/*': ['./collections/*/locations.json', './.generated/homepage.json'] },
 serverExternalPackages: ['sharp', 'postgres'],
 // The report renderer also runs as compiled Node ESM in the crawler.
 turbopack: { resolveAlias: { './gallery-ui.js': './src/reports/gallery-ui.ts', './home-display.js': './src/reports/home-display.ts' } },
};
export default config;
