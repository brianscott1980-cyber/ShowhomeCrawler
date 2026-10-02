export type UUID = string;
export interface Builder { id: UUID; name: string; slug: string; website_url: string }
export interface DevelopmentCandidate { externalId?: string; name: string; url: string; locationText?: string; postcode?: string }
export interface PropertyCandidate { externalId: string; houseTypeExternalId?: string; name: string; url: string; plotNumber?: string; bedrooms: number | null; price: number | null; propertyType: string | null; isDetached: boolean | null; available: boolean; status?: string }
export interface PropertyDetails extends PropertyCandidate { development: DevelopmentCandidate }
export interface GalleryImageCandidate { url: string; position: number; altText?: string; caption?: string }
export interface GalleryCandidate { images: GalleryImageCandidate[] }
export interface PropertyFilter { minBedrooms?: number; maxBedrooms?: number; minPrice?: number; maxPrice?: number; detachedOnly?: boolean; propertyTypes?: string[] }
export type CrawlJobStatus = 'queued' | 'running' | 'completed' | 'completed_with_errors' | 'failed' | 'cancelled';
export type CrawlItemStatus = 'discovered' | 'queued' | 'processing' | 'complete' | 'failed' | 'skipped';
export interface GalleryIdentityCandidate { firstImageSha256: string; firstImagePhash: string; imageCount: number; fingerprint?: string }
