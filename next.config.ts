import type { NextConfig } from 'next';
const config: NextConfig = {
 images: { unoptimized: true, localPatterns: [{pathname:'/api/assets/**',search:'?optimize=1'},{pathname:'/logos/**',search:''}] },
 // Images use the asset route's existing source redirect when not bundled.
 outputFileTracingExcludes: { '/*': ['./collections/**/*', './results/**/*', './.showhome/**/*', './.git/**/*'] },
 outputFileTracingIncludes: { '/api/classifications': ['./pipeline-reports/**/*'] },
 serverExternalPackages: ['sharp', 'postgres'],
 // The report renderer also runs as compiled Node ESM in the crawler.
 turbopack: { resolveAlias: { '../config/env.js': './src/config/env.ts', './gallery-ui.js': './src/reports/gallery-ui.ts', './home-display.js': './src/reports/home-display.ts' } },
};
export default config;
