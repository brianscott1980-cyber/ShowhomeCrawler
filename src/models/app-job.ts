import type { DeveloperSlug } from '../adapters/developers.js';
export interface JobInput {
 developer: DeveloperSlug; action: 'crawl' | 'classify';
 maxDevelopments: number; maxProperties: number; maxImages: number;
}
export interface AppJob { id: string; developer: string; action: string; status: string; startedAt: string; completedAt?: string; pid?: number; error?: string }
