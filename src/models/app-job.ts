export interface JobInput {
 developer: 'bellway' | 'cala'; action: 'crawl' | 'classify';
 maxDevelopments: number; maxProperties: number; maxImages: number;
}
export interface AppJob { id: string; developer: string; action: string; status: string; startedAt: string; completedAt?: string; pid?: number; error?: string }
